/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Path } from 'pathtrace';
import {
    expandPath,
    getPathValue,
    pathToArray,
    setPathValue,
} from 'pathtrace';
import type {
    IResultCache,
    ResultCacheOutcome,
    ResultCacheSnapshot,
} from '../cache';
import { GroupKey } from '../constants';
import { ValidupError, isError, isValidupError } from '../error';
import {
    buildErrorMessageForAttribute,
    buildOneOfFailedGroup,
    isOptionalValue,
    resolveDefaults,
    resolvePathFilter,
} from '../helpers';
import { hasOwnProperty, isObject } from '../utils';
import type { Validator, ValidatorDescriptor } from '../validator';
import { isValidatorDescriptor } from '../validator';
import { isContainer } from './check';
import type {
    ContainerInput,
    ContainerOptions,
    ContainerRunOptions,
    IContainer,
    Mount,
    MountOptions,
    Result,
} from './types';
import type { Issue } from '../issue';
import { IssueCode, defineIssueGroup, defineIssueItem } from '../issue';
import { RunSyncViolationError, isRunSyncViolation } from './run-sync-violation';

/**
 * Bundle of state the error path needs from the surrounding run loop.
 * Grouped to keep `collectExecutionFailure`'s signature readable and to make
 * additions (e.g. extra provenance fields for meta stamping) a one-line
 * change at every call site instead of a positional-arg shuffle.
 */
type ExecutionFailureContext<C> = {
    error: unknown,
    item: Mount<C>,
    /**
     * The input value handed to the failing mount — retained so we can
     * re-evaluate predicate-optional declarations at error time without
     * relying on a "predicate already returned false in the run loop"
     * invariant.
     */
    value: unknown,
    /** Expanded mount path. Prepended to nested `ValidupError` issues. */
    keyParts: PropertyKey[],
    /** Trailing path segment. Drives the wrapping `IssueGroup` shape. */
    pathRelative: PropertyKey | undefined,
    /** Accumulator the error path writes into. */
    issues: Issue[],
    /** Per-run abort signal. If aborted, the throw is re-raised verbatim. */
    signal: AbortSignal | undefined,
};

export class Container<
    T extends Record<string, any> = Record<string, any>,
    C = unknown,
> implements IContainer<T, C> {
    protected options : ContainerOptions<T>;

    protected items : Mount<C>[];

    // ----------------------------------------------

    constructor(options: ContainerOptions<T> = {}) {
        this.options = options;
        this.items = [];

        this.initialize();
    }

    // ----------------------------------------------

    mount(container: IContainer<any, any>) : void;

    mount(
        options: MountOptions,
        container: IContainer<any, any>
    ): void;

    mount(
        key: Path<T> | (string & {}),
        data: IContainer<any, any> | Validator<C> | ValidatorDescriptor<C>
    ) : void;

    mount(
        key: Path<T> | (string & {}),
        options: MountOptions,
        data: IContainer<any, any> | Validator<C> | ValidatorDescriptor<C>
    ) : void;

    mount(...args: any[]) : void {
        if (args.length < 1) {
            throw new SyntaxError('The mount method requires at least one argument');
        }
        if (args.length > 3) {
            throw new SyntaxError(`mount() accepts at most 3 arguments, got ${args.length}`);
        }

        let path : string | undefined;
        let pathSeen = false;

        let data: IContainer<any, any> | Validator<C> | ValidatorDescriptor<C> | undefined;
        let dataSeen = false;
        // Tracked separately so we don't re-detect on store — `isContainer` /
        // `isValidatorDescriptor` walk the value once each here, then the
        // result is consulted directly when we push onto `this.items`.
        let dataKind: 'container' | 'validator' | 'descriptor' | undefined;

        let options: MountOptions = {};
        let optionsSeen = false;

        for (const arg of args) {
            if (typeof arg === 'string') {
                if (pathSeen) {
                    throw new SyntaxError('mount() received multiple string arguments — only one path is supported.');
                }
                pathSeen = true;
                path = arg;
                continue;
            }

            if (typeof arg === 'function') {
                if (dataSeen) {
                    throw new SyntaxError('mount() received multiple validator/container arguments.');
                }
                dataSeen = true;
                data = arg;
                dataKind = 'validator';
                continue;
            }

            if (isContainer(arg)) {
                if (dataSeen) {
                    throw new SyntaxError('mount() received multiple validator/container arguments.');
                }
                dataSeen = true;
                data = arg;
                dataKind = 'container';
                continue;
            }

            // Descriptor check goes BEFORE the generic `isObject` branch:
            // a `ValidatorDescriptor` is an object that happens to carry
            // a `run` function but lacks `safeRun`, distinguishing it from
            // both `MountOptions` (no `run`) and `IContainer` (has both
            // `run` and `safeRun`).
            if (isValidatorDescriptor(arg)) {
                if (dataSeen) {
                    throw new SyntaxError('mount() received multiple validator/container arguments.');
                }
                dataSeen = true;
                data = arg;
                dataKind = 'descriptor';
                continue;
            }

            if (isObject(arg)) {
                if (optionsSeen) {
                    throw new SyntaxError('mount() received multiple options objects.');
                }
                optionsSeen = true;
                options = arg;
            }
        }

        if (
            dataKind !== 'container' &&
            (typeof path === 'undefined' || path.length === 0)
        ) {
            throw new SyntaxError('Only a container can be mounted without a key.');
        }

        if (typeof data === 'undefined' || typeof dataKind === 'undefined') {
            throw new SyntaxError('No container/validator could be extracted from the fn arguments.');
        }

        if (dataKind === 'container') {
            this.items.push({
                options,
                data: data as IContainer<any, any>,
                path,
                type: 'container',
            });

            return;
        }

        if (dataKind === 'descriptor') {
            const descriptor = data as ValidatorDescriptor<C>;
            this.items.push({
                options,
                data: descriptor.run,
                path,
                type: 'validator',
                sideEffect: descriptor.sideEffect,
            });
            return;
        }

        this.items.push({
            options,
            data: data as Validator<C>,
            path,
            type: 'validator',
        });
    }

    // ----------------------------------------------

    /**
     * Run the container against `data`. Default execution mode — async,
     * sequential, throws `ValidupError` on validation failure.
     *
     * Variants for the other execution modes:
     * - `run(data, { parallel: true })` — async, sequential→concurrent. Each
     *   mount captures `value` from `data` before any sibling runs, so chained
     *   sanitize-then-validate patterns are not supported.
     * - {@link Container.safeRun} — same as `run` but returns a discriminated
     *   `Result<T>` instead of throwing on validation failure (still rethrows
     *   on abort).
     * - {@link Container.runSync} / {@link Container.safeRunSync} — synchronous
     *   variants for graphs where every validator (and every nested container's
     *   `runSync`) is synchronous.
     *
     * Aborts surface verbatim — the abort is detected via `signal.throwIfAborted()`
     * between mounts (which throws `signal.reason`), and any error raised by a
     * mid-flight validator during an aborted run is re-thrown as-is rather than
     * folded into the issue tree. Callers can therefore distinguish "validation
     * failed" from "operation cancelled," but should not assume the thrown value
     * is always `signal.reason` — a validator that throws its own error before
     * the next abort check produces that error instead.
     *
     * @throws ValidupError on validation failure.
     * @throws signal.reason when the abort check fires between mounts.
     * @throws (mid-flight validator error) when a validator throws during an
     *         already-aborted run — re-raised as-is rather than wrapped.
     */
    async run(
        data: ContainerInput<T> = {},
        options: ContainerRunOptions<T, C> = {},
    ): Promise<T> {
        if (options.parallel) {
            return this.runParallel(data, options);
        }

        const { pathsToInclude, pathsToExclude } = this.resolveContainerFilters(options);

        const output: Record<string, any> = {};
        const issues: Issue[] = [];

        let itemCount = 0;
        let errorCount = 0;

        for (let i = 0; i < this.items.length; i++) {
            // Pre-mount abort check — cheap and short-circuits cleanly without
            // entering the per-mount try/catch (so aborts don't get rewritten
            // into validation issues).
            options.signal?.throwIfAborted();

            const item = this.items[i];

            if (!this.isItemGroupIncluded(item, options.group)) {
                continue;
            }

            let pathCount = 0;
            let pathFailed = false;
            const branchStart = issues.length;

            const keys: string[] = item.path ? expandPath(data, item.path) : [''];

            for (const key of keys) {
                const keyParts = key ? pathToArray(key) : [];

                const pathRelative = keyParts.at(-1);
                const pathAbsolute = [
                    ...(options.path ? options.path : []),
                    ...keyParts,
                ];

                let value: unknown;
                if (key.length > 0) {
                    value = hasOwnProperty(output, key) ?
                        output[key] :
                        getPathValue(data, key);
                } else {
                    value = data;
                }

                const filter = resolvePathFilter(
                    pathsToInclude,
                    pathsToExclude,
                    key,
                    item.type === 'container',
                );
                if (filter.skip) {
                    continue;
                }

                try {
                    const isOptional = typeof item.options.optional === 'function' ?
                        item.options.optional(value) :
                        item.options.optional &&
                            isOptionalValue(value, item.options.optionalValue);

                    if (isOptional) {
                        if (item.options.optionalInclude) {
                            output[key] = value;
                        }
                    } else if (item.type === 'container') {
                        const tmp = await item.data.run(
                            isObject(value) ? value : {},
                            {
                                group: options.group,
                                flat: true,
                                path: pathAbsolute,
                                pathsToInclude: filter.pathsToInclude,
                                pathsToExclude: filter.pathsToExclude,
                                defaults: resolveDefaults(options.defaults, key),
                                context: options.context,
                                signal: options.signal,
                                cache: options.cache,
                            },
                        );

                        const tmpKeys = Object.keys(tmp);
                        for (const tmpKey of tmpKeys) {
                            output[this.mergePaths(key, tmpKey)] = tmp[tmpKey];
                        }
                    } else if (item.type === 'validator') {
                        const snapshot: ResultCacheSnapshot = {
                            value,
                            context: options.context,
                            group: options.group,
                        };
                        const cached = this.resolveCachedOutcome(item, key, snapshot, options.cache);
                        if (cached) {
                            if (cached.ok) {
                                output[key] = cached.value;
                            } else {
                                // Replay the prior error through the same outer-catch
                                // path so issue construction (path prefixing, optional
                                // stamping) runs with the *current* `keyParts` — vital
                                // when the same container is mounted under different
                                // parents across runs.
                                throw cached.error;
                            }
                        } else {
                            try {
                                const result = await item.data({
                                    key,
                                    path: pathAbsolute,

                                    value,
                                    data,
                                    group: options.group,
                                    context: options.context as C,
                                    signal: options.signal,
                                    cache: options.cache,
                                });
                                output[key] = result;
                                this.writeCachedOutcome(
                                    item,
                                    key,
                                    snapshot,
                                    { ok: true, value: result },
                                    options.cache,
                                    options.signal,
                                );
                            } catch (e) {
                                this.writeCachedOutcome(
                                    item,
                                    key,
                                    snapshot,
                                    { ok: false, error: e },
                                    options.cache,
                                    options.signal,
                                );
                                throw e;
                            }
                        }
                    }
                } catch (e) {
                    this.collectExecutionFailure({
                        error: e,
                        item,
                        value,
                        keyParts,
                        pathRelative,
                        issues,
                        signal: options.signal,
                    });
                    pathFailed = true;
                }

                pathCount++;
            }

            if (pathCount > 0) {
                itemCount++;

                if (pathFailed) {
                    errorCount++;
                    this.wrapBranchForOneOf(issues, branchStart, item, i);
                }
            }
        }

        return this.finalizeOutput(output, options, issues, errorCount, itemCount);
    }

    /**
     * Parallel-execution variant of `run()`. All mounts kick off their
     * promises eagerly and the results are merged after `Promise.allSettled`.
     * See `ContainerRunOptions.parallel` for the trade-off note.
     */
    private async runParallel(
        data: ContainerInput<T>,
        options: ContainerRunOptions<T, C>,
    ): Promise<T> {
        const { pathsToInclude, pathsToExclude } = this.resolveContainerFilters(options);

        const output: Record<string, any> = {};
        const issues: Issue[] = [];

        type KeyTask = {
            key: string,
            keyParts: PropertyKey[],
            pathRelative: PropertyKey | undefined,
            // Retained for `collectExecutionFailure` so it can re-evaluate
            // predicate-optional mounts at error time.
            value: unknown,
            promise: Promise<unknown>,
            kind: 'container' | 'validator',
        };

        type ItemGroup = {
            item: Mount<C>,
            // Original registration index in `this.items`. Tracked separately
            // from the position in `itemGroups` because group-filtered mounts
            // are dropped from `itemGroups` — without this, `data.branch`
            // emitted by `wrapBranchForOneOf` would not match the
            // registration order seen by the consumer.
            mountIndex: number,
            tasks: KeyTask[],
            // optional/skip paths that completed inline still count toward
            // the per-item pathCount used for oneOf / errorCount tracking.
            syncPathCount: number,
        };

        const itemGroups: ItemGroup[] = [];

        for (let i = 0; i < this.items.length; i++) {
            options.signal?.throwIfAborted();

            const item = this.items[i];
            if (!this.isItemGroupIncluded(item, options.group)) {
                continue;
            }

            const tasks: KeyTask[] = [];
            let syncPathCount = 0;

            const keys: string[] = item.path ? expandPath(data, item.path) : [''];
            for (const key of keys) {
                const keyParts = key ? pathToArray(key) : [];
                const pathRelative = keyParts.at(-1);
                const pathAbsolute = [
                    ...(options.path ? options.path : []),
                    ...keyParts,
                ];

                let value: unknown;
                if (key.length > 0) {
                    // Parallel mode reads `data` only — `output[key]` from a
                    // sibling mount is intentionally NOT consulted (the
                    // sibling may not have completed yet).
                    value = getPathValue(data, key);
                } else {
                    value = data;
                }

                const filter = resolvePathFilter(
                    pathsToInclude,
                    pathsToExclude,
                    key,
                    item.type === 'container',
                );
                if (filter.skip) {
                    continue;
                }

                const isOptional = typeof item.options.optional === 'function' ?
                    item.options.optional(value) :
                    item.options.optional &&
                        isOptionalValue(value, item.options.optionalValue);

                if (isOptional) {
                    if (item.options.optionalInclude) {
                        output[key] = value;
                    }
                    syncPathCount++;
                    continue;
                }

                let promise: Promise<unknown>;
                if (item.type === 'container') {
                    promise = item.data.run(
                        isObject(value) ? value : {},
                        {
                            group: options.group,
                            flat: true,
                            path: pathAbsolute,
                            pathsToInclude: filter.pathsToInclude,
                            pathsToExclude: filter.pathsToExclude,
                            defaults: resolveDefaults(options.defaults, key),
                            context: options.context,
                            signal: options.signal,
                            parallel: true,
                            cache: options.cache,
                        },
                    );
                } else {
                    const snapshot: ResultCacheSnapshot = {
                        value,
                        context: options.context,
                        group: options.group,
                    };
                    const cached = this.resolveCachedOutcome(item, key, snapshot, options.cache);
                    if (cached) {
                        // Materialize cached outcomes as already-settled promises
                        // so the existing `Promise.allSettled` merge loop handles
                        // them identically to fresh runs — no parallel-specific
                        // replay code path.
                        promise = cached.ok ?
                            Promise.resolve(cached.value) :
                            Promise.reject(cached.error);
                    } else {
                        // Wrap sync validators in a microtask so the surrounding
                        // `Promise.allSettled` always sees a thenable. Cache
                        // writes happen inside the wrapper so the entry is
                        // persisted before the promise settles.
                        const itemData = item.data;
                        const captureItem = item;
                        const captureKey = key;
                        const captureSnapshot = snapshot;
                        promise = (async () => {
                            try {
                                const result = await itemData({
                                    key,
                                    path: pathAbsolute,
                                    value,
                                    data,
                                    group: options.group,
                                    context: options.context as C,
                                    signal: options.signal,
                                    cache: options.cache,
                                });
                                this.writeCachedOutcome(
                                    captureItem,
                                    captureKey,
                                    captureSnapshot,
                                    { ok: true, value: result },
                                    options.cache,
                                    options.signal,
                                );
                                return result;
                            } catch (e) {
                                this.writeCachedOutcome(
                                    captureItem,
                                    captureKey,
                                    captureSnapshot,
                                    { ok: false, error: e },
                                    options.cache,
                                    options.signal,
                                );
                                throw e;
                            }
                        })();
                    }
                }

                tasks.push({
                    key,
                    keyParts,
                    pathRelative,
                    value,
                    promise,
                    kind: item.type,
                });
            }

            if (tasks.length > 0 || syncPathCount > 0) {
                itemGroups.push({
                    item,
                    mountIndex: i,
                    tasks,
                    syncPathCount,
                });
            }
        }

        // Wait for all groups concurrently. Promises were already kicked off
        // eagerly above; this just collects their settled state.
        const settledByGroup = await Promise.all(itemGroups.map(
            (group) => Promise.allSettled(group.tasks.map((t) => t.promise)),
        ));

        // Re-check the abort signal after settling. Sequential `run`/`runSync`
        // probe between every mount; the parallel variant can only check here
        // and before `finalizeOutput`. Without this, validators that ignore
        // `ctx.signal` would let an aborted run resolve to a successful result.
        options.signal?.throwIfAborted();

        let itemCount = 0;
        let errorCount = 0;

        for (const [i, {
            item,
            mountIndex,
            tasks,
            syncPathCount,
        }] of itemGroups.entries()) {
            const settled = settledByGroup[i];

            let pathFailed = false;
            const branchStart = issues.length;
            for (const [j, task] of tasks.entries()) {
                const result = settled[j];

                if (result.status === 'fulfilled') {
                    if (task.kind === 'container') {
                        const tmp = result.value as Record<string, any>;
                        const tmpKeys = Object.keys(tmp);
                        for (const tmpKey of tmpKeys) {
                            output[this.mergePaths(task.key, tmpKey)] = tmp[tmpKey];
                        }
                    } else {
                        output[task.key] = result.value;
                    }
                } else {
                    this.collectExecutionFailure({
                        error: result.reason,
                        item,
                        value: task.value,
                        keyParts: task.keyParts,
                        pathRelative: task.pathRelative,
                        issues,
                        signal: options.signal,
                    });
                    pathFailed = true;
                }
            }

            if (tasks.length + syncPathCount > 0) {
                itemCount++;
                if (pathFailed) {
                    errorCount++;
                    // Use the original registration index so `data.branch`
                    // matches the registration order regardless of group
                    // filtering — sequential `run()` / `runSync()` already
                    // pass the registration index directly.
                    this.wrapBranchForOneOf(issues, branchStart, item, mountIndex);
                }
            }
        }

        // Final guard before returning a (potentially successful) value — if
        // the run was aborted after the post-settle check but before the merge
        // loop finished, propagate the abort instead of returning stale data.
        options.signal?.throwIfAborted();

        return this.finalizeOutput(output, options, issues, errorCount, itemCount);
    }

    async safeRun(input: ContainerInput<T> = {}, options: ContainerRunOptions<T, C> = {}): Promise<Result<T>> {
        try {
            const data = await this.run(input, options);
            return { success: true, data };
        } catch (e) {
            return this.wrapSafeRunError(e, options);
        }
    }

    /**
     * Synchronous variant of {@link Container.run}. Use it for purely
     * synchronous validator graphs where the microtask overhead of `await`
     * per mount matters (e.g. driving a reactive UI without a `pending`
     * flicker on every keystroke).
     *
     * Each mounted validator's return value MUST NOT be a thenable, and every
     * nested container MUST implement `runSync`. Either violation throws
     * `RunSyncViolationError` (structural — distinct from validation
     * failures), so the diagnostic is surfaced verbatim rather than wrapped
     * into a `ValidupError`. The companion {@link Container.safeRunSync}
     * still rethrows these for the same reason.
     *
     * No `parallel` variant — synchronous graphs don't benefit from
     * concurrency, and `Promise.allSettled` is async by definition.
     *
     * Aborts surface the same way as {@link Container.run}: the
     * `signal.throwIfAborted()` check between mounts throws `signal.reason`,
     * and a mid-flight validator throw during an already-aborted run is
     * re-raised verbatim. Don't assume the thrown value is always
     * `signal.reason`.
     *
     * @throws ValidupError on validation failure.
     * @throws RunSyncViolationError when a validator returns a Promise or a
     *         nested container does not implement `runSync`.
     * @throws signal.reason when the abort check fires between mounts.
     * @throws (mid-flight validator error) when a validator throws during an
     *         already-aborted run.
     */
    runSync(
        data: ContainerInput<T> = {},
        options: ContainerRunOptions<T, C> = {},
    ): T {
        const { pathsToInclude, pathsToExclude } = this.resolveContainerFilters(options);

        const output: Record<string, any> = {};
        const issues: Issue[] = [];

        let itemCount = 0;
        let errorCount = 0;

        for (let i = 0; i < this.items.length; i++) {
            options.signal?.throwIfAborted();

            const item = this.items[i];

            if (!this.isItemGroupIncluded(item, options.group)) {
                continue;
            }

            let pathCount = 0;
            let pathFailed = false;
            const branchStart = issues.length;

            const keys: string[] = item.path ? expandPath(data, item.path) : [''];

            for (const key of keys) {
                const keyParts = key ? pathToArray(key) : [];

                const pathRelative = keyParts.at(-1);
                const pathAbsolute = [
                    ...(options.path ? options.path : []),
                    ...keyParts,
                ];

                let value: unknown;
                if (key.length > 0) {
                    value = hasOwnProperty(output, key) ?
                        output[key] :
                        getPathValue(data, key);
                } else {
                    value = data;
                }

                const filter = resolvePathFilter(
                    pathsToInclude,
                    pathsToExclude,
                    key,
                    item.type === 'container',
                );
                if (filter.skip) {
                    continue;
                }

                try {
                    const isOptional = typeof item.options.optional === 'function' ?
                        item.options.optional(value) :
                        item.options.optional &&
                            isOptionalValue(value, item.options.optionalValue);

                    if (isOptional) {
                        if (item.options.optionalInclude) {
                            output[key] = value;
                        }
                    } else if (item.type === 'container') {
                        const childRunSync = (
                            item.data as IContainer<any, any> & {
                                runSync?: (...args: any[]) => any
                            }
                        ).runSync;
                        if (typeof childRunSync !== 'function') {
                            throw new RunSyncViolationError(`runSync: nested container at "${key || '<root>'}" does not implement runSync`);
                        }

                        const tmp = childRunSync.call(item.data, isObject(value) ? value : {}, {
                            group: options.group,
                            flat: true,
                            path: pathAbsolute,
                            pathsToInclude: filter.pathsToInclude,
                            pathsToExclude: filter.pathsToExclude,
                            defaults: resolveDefaults(options.defaults, key),
                            context: options.context,
                            signal: options.signal,
                            cache: options.cache,
                        });

                        const tmpKeys = Object.keys(tmp);
                        for (const tmpKey of tmpKeys) {
                            output[this.mergePaths(key, tmpKey)] = tmp[tmpKey];
                        }
                    } else if (item.type === 'validator') {
                        const snapshot: ResultCacheSnapshot = {
                            value,
                            context: options.context,
                            group: options.group,
                        };
                        const cached = this.resolveCachedOutcome(item, key, snapshot, options.cache);
                        if (cached) {
                            if (cached.ok) {
                                output[key] = cached.value;
                            } else {
                                throw cached.error;
                            }
                        } else {
                            try {
                                const result = item.data({
                                    key,
                                    path: pathAbsolute,

                                    value,
                                    data,
                                    group: options.group,
                                    context: options.context as C,
                                    signal: options.signal,
                                    cache: options.cache,
                                });
                                if (
                                    result !== null &&
                                    typeof result === 'object' &&
                                    typeof (result as { then?: unknown }).then === 'function'
                                ) {
                                    // Don't cache: structural violation, not a
                                    // validation outcome.
                                    throw new RunSyncViolationError(`runSync: validator at "${key || '<root>'}" returned a Promise`);
                                }
                                output[key] = result;
                                this.writeCachedOutcome(
                                    item,
                                    key,
                                    snapshot,
                                    { ok: true, value: result },
                                    options.cache,
                                    options.signal,
                                );
                            } catch (e) {
                                // RunSyncViolation is structural — don't pollute
                                // the cache with a graph-level error that the
                                // next run might reach through different mounts.
                                if (!isRunSyncViolation(e)) {
                                    this.writeCachedOutcome(
                                        item,
                                        key,
                                        snapshot,
                                        { ok: false, error: e },
                                        options.cache,
                                        options.signal,
                                    );
                                }
                                throw e;
                            }
                        }
                    }
                } catch (e) {
                    this.collectExecutionFailure({
                        error: e,
                        item,
                        value,
                        keyParts,
                        pathRelative,
                        issues,
                        signal: options.signal,
                    });
                    pathFailed = true;
                }

                pathCount++;
            }

            if (pathCount > 0) {
                itemCount++;

                if (pathFailed) {
                    errorCount++;
                    this.wrapBranchForOneOf(issues, branchStart, item, i);
                }
            }
        }

        return this.finalizeOutput(output, options, issues, errorCount, itemCount);
    }

    safeRunSync(input: ContainerInput<T> = {}, options: ContainerRunOptions<T, C> = {}): Result<T> {
        try {
            const data = this.runSync(input, options);
            return { success: true, data };
        } catch (e) {
            return this.wrapSafeRunError(e, options);
        }
    }

    /**
     * Lookup helper for the per-mount result cache.
     *
     * Returns `undefined` (forcing a real run) for any of:
     * - No `cache` supplied — caller didn't opt in.
     * - Mount isn't a validator — container mounts run their own
     *   inner loop, which consults the cache for their own mounts.
     * - Validator declared `sideEffect: true` — its result depends on
     *   inputs the snapshot doesn't capture (sibling fields, network,
     *   global state), so caching would be unsound.
     * - No prior entry stored for this `(mount, key)` pair.
     * - Stored snapshot's `value` / `context` / `group` don't all match
     *   the current invocation by `Object.is`.
     */
    private resolveCachedOutcome(
        item: Mount<C>,
        key: string,
        snapshot: ResultCacheSnapshot,
        cache: IResultCache | undefined,
    ): ResultCacheOutcome | undefined {
        if (
            !cache ||
            item.type !== 'validator' ||
            item.sideEffect === true
        ) {
            return undefined;
        }
        const entry = cache.get(item, key);
        if (!entry) {
            return undefined;
        }
        if (
            Object.is(entry.snapshot.value, snapshot.value) &&
            Object.is(entry.snapshot.context, snapshot.context) &&
            Object.is(entry.snapshot.group, snapshot.group)
        ) {
            return entry.outcome;
        }
        return undefined;
    }

    /**
     * Store the outcome of a fresh validator invocation. No-ops in the
     * same cases `resolveCachedOutcome` returns `undefined` for, plus:
     *
     * - `signal.aborted` — the throw was caused by cancellation, not by
     *   a validation outcome we want to remember. Caching the abort
     *   would mean future replays surface "AbortError" as a fake
     *   validation issue every time the same snapshot is seen, even
     *   in fully-completed runs.
     *
     * `RunSyncViolationError`s are filtered out at the call site
     * (`runSync` only) because they're structural — the validator
     * graph is wrong, not the input.
     */
    private writeCachedOutcome(
        item: Mount<C>,
        key: string,
        snapshot: ResultCacheSnapshot,
        outcome: ResultCacheOutcome,
        cache: IResultCache | undefined,
        signal: AbortSignal | undefined,
    ): void {
        if (
            !cache ||
            item.type !== 'validator' ||
            item.sideEffect === true ||
            signal?.aborted
        ) {
            return;
        }
        cache.set(item, key, { snapshot, outcome });
    }

    private resolveContainerFilters(options: ContainerRunOptions<T, C>): {
        pathsToInclude: string[] | undefined,
        pathsToExclude: string[] | undefined,
    } {
        let pathsToInclude: string[] | undefined;
        if (options.pathsToInclude) {
            pathsToInclude = options.pathsToInclude as string[];
        } else if (this.options.pathsToInclude) {
            pathsToInclude = this.options.pathsToInclude as string[];
        }

        let pathsToExclude: string[] | undefined;
        if (options.pathsToExclude) {
            pathsToExclude = options.pathsToExclude as string[];
        } else if (this.options.pathsToExclude) {
            pathsToExclude = this.options.pathsToExclude as string[];
        }

        return { pathsToInclude, pathsToExclude };
    }

    /**
     * Prepend `keyParts` to a child issue's `path` and — when the child is
     * an `IssueGroup` — recurse into its nested issues so every leaf carries
     * the parent prefix. Without recursion, a child container that already
     * wrapped its own multi-issue mount in a group (or a `oneOf` child) would
     * surface inner items with paths missing the parent segment, breaking
     * downstream consumers that rely on `flattenIssueItems` for per-field
     * lookup (e.g. `@validup/vue`).
     */
    private prefixIssuePath(issue: Issue, keyParts: PropertyKey[]): Issue {
        const prefixed: Issue = {
            ...issue,
            path: [...keyParts, ...(issue.path || [])],
        };
        if (prefixed.type === 'group') {
            prefixed.issues = prefixed.issues.map(
                (nested) => this.prefixIssuePath(nested, keyParts),
            );
        }
        return prefixed;
    }

    /**
     * Translate a throw raised by one execution step (one validator or
     * nested-container invocation, from the surrounding `run` loop) into
     * accumulated issues and push them onto `context.issues`. Re-throws when
     * the run was aborted (signal-aware validators) so abort errors are not
     * mangled into validation issues.
     *
     * "Mount" is the *setup-time* verb (`container.mount(...)`); what failed
     * here is the *execution* of an already-mounted unit — hence the name.
     *
     * The context object captures everything the error path needs to know
     * about the failing step: the thrown value (`error`), the mount
     * descriptor (`item`), the current input (`value` — kept around so we
     * can re-evaluate predicate-optional declarations at error time), the
     * expanded path (`keyParts` — used to prepend to nested `ValidupError`
     * issues) and the trailing segment (`pathRelative` — used when wrapping
     * multi-issue or container emissions into an `IssueGroup`). The
     * destination accumulator (`issues`) and the abort `signal` round out
     * what's needed to handle the failure.
     *
     * @modifies context.issues — appends one or more entries per call.
     */
    private collectExecutionFailure(context: ExecutionFailureContext<C>): void {
        const {
            error,
            item,
            value,
            keyParts,
            pathRelative,
            issues,
            signal,
        } = context;

        if (signal?.aborted) {
            throw error;
        }
        // Structural runSync violations are not validation outcomes — they
        // mean the caller can't use runSync against this graph. Surface the
        // diagnostic verbatim instead of wrapping it as "Property X is invalid".
        if (isRunSyncViolation(error)) {
            throw error;
        }

        // Mounts whose `optional` declaration resolves truthy for the current
        // `value` stamp their own emissions with `meta.optional: true`, so
        // consumers (e.g. `@validup/vue`'s severity helper) can downgrade UX
        // gating for fields the schema permits to be blank.
        //
        // Resolution mirrors the run-loop check (e.g. lines 254-256):
        //
        // - `optional: true`  → tag
        // - `optional: false` → don't tag (matches runtime's truthy filter)
        // - `optional: (v) => boolean` → invoke the predicate with the
        //    current value and tag iff it returns truthy. Today the run
        //    loop only enters this error path when the predicate returned
        //    false (otherwise the validator would have been skipped), so
        //    this branch is effectively "don't tag" — but the explicit
        //    re-evaluation keeps the code's intent self-evident and
        //    decouples it from that invariant.
        // - `optional: undefined` → don't tag
        //
        // Per the "no inheritance" decision: issues bubbled up unchanged from
        // a child Container's own `ValidupError` are NOT stamped here — the
        // child's own per-mount tagging is authoritative, and a leaf inside a
        // required-on-its-own-mount field stays unmarked even if its parent
        // mount was optional. This matches the "if you DO provide a role, the
        // role's required fields are still required" semantics.
        const isOptionalMount = typeof item.options.optional === 'function' ?
            Boolean(item.options.optional(value)) :
            item.options.optional === true
        ;
        // Shallow stamp — only the top-level `issue.meta`. Used for the
        // wrapping `IssueGroup` we emit for container mounts (Option B: do
        // not propagate the parent's optional flag onto the bubbled-up child
        // leaves, which retain their own per-mount tagging) and for leaves
        // we construct directly via `defineIssueItem`.
        //
        // We reassign `issue.meta` to a FRESH object rather than mutating
        // the existing one. The top-level `issue` is always safe to mutate
        // here (it's a fresh object from `prefixIssuePath`'s shallow spread
        // or one of the `defineIssue*` factories), but the inner `meta`
        // object can be shared with the validator's original
        // `ValidupError.issues[i].meta` — mutating in place would leak
        // `optional: true` back into the validator's own (possibly cached
        // or replayed) error.
        const markOptional = <I extends Issue>(issue: I): I => {
            if (!isOptionalMount) {
                return issue;
            }
            issue.meta = { ...(issue.meta ?? {}), optional: true };
            return issue;
        };

        // Deep stamp — recurse into `IssueGroup.issues`. Used ONLY when the
        // whole tree was produced by *this* validator (e.g. an integration
        // adapter that threw `ValidupError([defineIssueGroup({ issues: [...] })])`).
        // Without this, `flattenIssueItems` would pull out the inner leaves
        // and miss `meta.optional` on them. Not used for container mounts —
        // see Option B above.
        const markOptionalDeep = <I extends Issue>(issue: I): I => {
            if (!isOptionalMount) {
                return issue;
            }
            markOptional(issue);
            if (issue.type === 'group') {
                issue.issues = issue.issues.map((nested) => markOptionalDeep(nested));
            }
            return issue;
        };

        const childIssues: Issue[] = [];

        if (isValidupError(error)) {
            for (let i = 0; i < error.issues.length; i++) {
                const prefixed = this.prefixIssuePath(error.issues[i], keyParts);
                // Stamp only when a *validator* threw `ValidupError` directly
                // (e.g. an integration adapter like `@validup/zod` reshaping
                // a foreign error into validup issues). Deep so that a
                // validator returning a nested `IssueGroup` tags leaves too.
                // For child Container runs, leave the bubbled tree alone —
                // see comment above.
                childIssues.push(item.type === 'validator' ? markOptionalDeep(prefixed) : prefixed);
            }
        } else if (isError(error)) {
            childIssues.push(markOptional(defineIssueItem({
                path: keyParts,
                message: error.message,
            })));
        } else {
            // Non-`Error` throw (string, plain object, null, …). Without a
            // synthetic issue here, the run would still flag the mount as
            // failed but the resulting `ValidupError.issues` would not
            // mention the throw at all — caller sees "validation failed"
            // with no diagnostic. Surface the stringified value so the
            // failure is at least traceable.
            childIssues.push(markOptional(defineIssueItem({
                path: keyParts,
                message: typeof error === 'string' && error.length > 0 ? error : `Non-Error throw: ${String(error)}`,
            })));
        }

        if (pathRelative) {
            if (item.type === 'container' || childIssues.length > 1) {
                // The wrapping group is itself an emission of *this* mount —
                // stamp it (shallow) so a tree-walking consumer can read the
                // optional signal at the group level. The leaves inside
                // follow the "no inheritance" rule and stay untouched for
                // container mounts; for multi-leaf validator mounts, the
                // leaves were already stamped above.
                issues.push(markOptional(defineIssueGroup({
                    message: buildErrorMessageForAttribute(String(pathRelative)),
                    data: { name: String(pathRelative) },
                    path: keyParts,
                    issues: childIssues,
                })));
            } else {
                issues.push(...childIssues);
            }
        } else {
            issues.push(...childIssues);
        }
    }

    /**
     * For `oneOf` containers, wrap the issues produced by a single branch
     * (slice from `branchStart` to the end of `issues`) into one sub-group
     * so per-branch identity is preserved in the final aggregate. Non-oneOf
     * containers leave the issue list untouched — they don't need branch
     * partitioning.
     *
     * The wrapping group's `path` is `[]` (the branch wraps everything
     * inside it; per-leaf paths are unchanged); `data.branch` is the
     * mount index; and `data.name` (when set) is the mount path so
     * consumers can label "branch X failed" without recomputing the
     * registration order.
     */
    private wrapBranchForOneOf(
        issues: Issue[],
        branchStart: number,
        item: Mount<C>,
        branchIndex: number,
    ): void {
        if (!this.options.oneOf) {
            return;
        }
        const branchIssues = issues.splice(branchStart);
        const data: Record<string, unknown> = { branch: branchIndex };
        if (item.path) {
            data.name = item.path;
        }
        issues.push(defineIssueGroup({
            message: item.path ?
                `Branch "${item.path}" failed` :
                `Branch ${branchIndex} failed`,
            data,
            path: [],
            issues: branchIssues,
        }));
    }

    /**
     * Apply post-loop semantics: oneOf aggregation, error throw, defaults
     * fill, and flat-vs-nested output expansion.
     */
    private finalizeOutput(
        output: Record<string, any>,
        options: ContainerRunOptions<T, C>,
        issues: Issue[],
        errorCount: number,
        itemCount: number,
    ): T {
        if (this.options.oneOf) {
            // Guard against the "all branches filtered out" case (group /
            // pathsToInclude / pathsToExclude can leave itemCount === 0).
            // Without it, a oneOf container with nothing to run would throw
            // ONE_OF_FAILED with an empty issues list. Shared
            // `buildOneOfFailedGroup` keeps the ONE_OF_FAILED shape in
            // lockstep with compose's any-of path so consumers / i18n
            // catalogs only format one variant.
            if (itemCount > 0 && errorCount === itemCount) {
                throw new ValidupError([buildOneOfFailedGroup(issues, { path: options.path ? options.path : [] })]);
            }
        } else if (errorCount > 0) {
            throw new ValidupError(issues);
        }

        if (options.defaults) {
            const defaultKeys = Object.keys(options.defaults);
            for (const defaultKey of defaultKeys) {
                if (
                    !hasOwnProperty(output, defaultKey) ||
                    typeof output[defaultKey] === 'undefined'
                ) {
                    output[defaultKey] = (options.defaults as Record<string, any>)[defaultKey];
                }
            }
        }

        if (options.flat) {
            return output as T;
        }

        const temp: Record<string, any> = {};
        const keys = Object.keys(output);
        for (const key of keys) {
            setPathValue(temp, key, output[key]);
        }
        return temp as T;
    }

    private wrapSafeRunError(e: unknown, options: ContainerRunOptions<T, C>): Result<T> {
        // Abort is not a validation outcome — propagate it. Wrapping it
        // as a synthetic `Result.failure` would produce a misleading
        // "AbortError" issue at path `[]`.
        if (options.signal?.aborted) {
            throw e;
        }
        // Same reasoning for `runSync` structural violations.
        if (isRunSyncViolation(e)) {
            throw e;
        }

        if (isValidupError(e)) {
            return { success: false, error: e };
        }

        if (isError(e)) {
            return {
                success: false,
                error: new ValidupError([
                    defineIssueItem({
                        path: [],
                        message: e.message,
                    }),
                ]),
            };
        }

        // Non-`Error` throw (string, plain object, null, …). Surface a
        // stringified diagnostic so `Result.error.issues` is never empty —
        // an empty issue list with `success: false` is a confusing API
        // signal ("validation failed" with no diagnostic) and is what
        // landed in 0.x for non-Error throws.
        return {
            success: false,
            error: new ValidupError([
                defineIssueItem({
                    path: [],
                    message: typeof e === 'string' && e.length > 0 ? e : `Non-Error throw: ${String(e)}`,
                }),
            ]),
        };
    }

    private isItemGroupIncluded(
        item: Mount<C>,
        group?: string,
    ) : boolean {
        if (group === GroupKey.WILDCARD) {
            return true;
        }

        if (item.options.group) {
            if (Array.isArray(item.options.group)) {
                if (item.options.group.includes(GroupKey.WILDCARD)) {
                    return true;
                }

                if (group && item.options.group.includes(group)) {
                    return true;
                }
            } else {
                if (item.options.group === GroupKey.WILDCARD) {
                    return true;
                }

                if (item.options.group === group) {
                    return true;
                }
            }

            return false;
        }

        return true;
    }

    /**
     * Join flat-output keys with `.` separators, preserving any pre-existing
     * leading dot on the right-hand side. Note: keys containing a *literal*
     * dot collide with the dotted-path syntax used for nested-output
     * expansion (see `setPathValue` in `pathtrace`) and will produce
     * ambiguous output when re-expanded — avoid mounting/returning such keys.
     */
    private mergePaths(...args: (string | undefined)[]) {
        let output : string = '';

        for (const arg of args) {
            if (!arg || arg.length === 0) {
                continue;
            }

            if (arg.at(0) === '.') {
                output += arg;
            } else {
                output += output.length > 0 ? `.${arg}` : arg;
            }
        }

        return output;
    }

    protected initialize() : void {

    }
}
