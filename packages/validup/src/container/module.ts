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
import type { PathFilterResolution } from '../helpers';
import {
    buildErrorMessageForAttribute,
    buildOneOfFailedGroup,
    errorToIssues,
    isOptionalValue,
    resolveDefaults,
    resolvePathFilter,
    stringifyPath,
} from '../helpers';
import { hasOwnProperty, isObject } from '../utils';
import type { TwinBody } from 'twinop';
import { op, runTwinAsync, runTwinSync } from 'twinop';
import type {
    Validator,
    ValidatorContext,
    ValidatorDescriptor,
} from '../validator';
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
import type { Issue } from '@ebec/core';
import {
    IssueCode,
    defineIssueGroup,
    defineIssueItem,
    prefixIssuePath,
} from '@ebec/core';
import { RunSyncViolationError } from './run-sync-violation';
import { PathsStrictViolationError } from './paths-strict-violation';
import { isStructuralThrow } from './structural-throw';

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

/**
 * Everything a single `(mount, expanded key)` pair needs before the mount can
 * be dispatched. Produced once per key by `Container.prepareMountKey` and
 * consumed identically by the twin body and by `runParallel`.
 *
 * Notably absent: the mount's input `value`. Sequential runs chain-read
 * `output` before `data` (so sanitize-then-validate works across sibling
 * mounts) while `runParallel` reads `data` only — that asymmetry is a
 * documented behavioural difference, so it stays in the caller and this stays
 * pure.
 */
type MountKeyPlan = {
    /** Expanded key split into segments. Prefixed onto child issue paths. */
    keyParts: PropertyKey[],
    /** Trailing segment. Drives the wrapping `IssueGroup` shape on failure. */
    pathRelative: PropertyKey | undefined,
    /** Global path (parent prefix + `keyParts`) handed to validators/children. */
    pathAbsolute: PropertyKey[],
    /** Include/exclude verdict plus the sub-lists to forward to a child. */
    filter: PathFilterResolution,
};

/**
 * Outcome of the optional gate for one `(mount, value)` pair.
 *
 * - `skip: false` — the mount runs normally.
 * - `skip: true, write: true` — the mount is skipped and `value` is assigned
 *   to `output[key]`.
 * - `skip: true, write: false` — the mount is skipped and the key is omitted.
 *
 * `write` is what carries the presence-not-value semantics of `optionalAs`:
 * `{ skip: true, write: true, value: undefined }` is the deliberate "emit
 * `undefined`" directive, distinct from "omit the key".
 */
type OptionalDirective = {
    skip: boolean,
    write: boolean,
    value?: unknown,
};

/**
 * Structural thenable probe. Used by the sync side of the validator effect to
 * reject the one thing a synchronous graph cannot tolerate: a validator that
 * returned a promise.
 */
function isThenable(input: unknown): input is PromiseLike<unknown> {
    return isObject(input) &&
        typeof (input as { then?: unknown }).then === 'function';
}

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

        return runTwinAsync(this.runBody(data, options));
    }

    /**
     * The single mount-resolution loop behind {@link Container.run} and
     * {@link Container.runSync}.
     *
     * Written as a **twin body** (the `twinop` package): the two impure edges,
     * invoking a validator and descending into a nested container, are yielded
     * as `op(asyncThunk, syncThunk)` pairs, and the driver chosen by the public
     * method (`runTwinAsync` / `runTwinSync`) executes the matching side. Effect
     * errors are thrown back in at the `yield` site, so the cache-write and
     * issue-collection `try`/`catch` blocks below run identically in both
     * variants, with no second copy of the loop to keep in lockstep.
     *
     * The sync thunks own the two structural probes that only `runSync` needs:
     * a nested container that doesn't implement `runSync`, and a validator that
     * returned a thenable. Both throw `RunSyncViolationError`, which the async
     * side cannot produce.
     *
     * `runParallel` deliberately does NOT share this body — a generator is
     * sequential by construction, and expressing "launch every mount, then
     * settle" through it would mean yielding batches and giving up the
     * chain-read. It shares the extracted per-key helpers instead
     * (`prepareMountKey` / `resolveOptionalDirective` / `buildChildRunOptions` /
     * `buildValidatorContext`).
     */
    private * runBody(
        data: ContainerInput<T>,
        options: ContainerRunOptions<T, C>,
    ): TwinBody<T> {
        const { pathsToInclude, pathsToExclude } = this.resolveContainerFilters(options);
        const pathsStrict = this.resolvePathsStrict(options);
        // Structural pre-flight — throws before any validator runs.
        this.assertPathsStrict(pathsStrict, data, pathsToInclude, pathsToExclude, options.path);

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

            // Path expansion reads the input, so a hostile accessor (an ORM
            // entity with a lazy relation, a computed getter, a Proxy trap)
            // throws here — before any key exists. Contained rather than left
            // to escape: an escape aborts the whole loop and discards every
            // issue collected by earlier mounts, turning a real multi-field
            // failure into one path-less item. `keys` stays empty so the key
            // loop is skipped while the shared bookkeeping below still counts
            // the mount as one failed path.
            let keys: string[] = [];
            try {
                keys = item.path ? expandPath(data, item.path) : [''];
            } catch (e) {
                const attribution = this.describeKey(item.path || '');
                this.collectExecutionFailure({
                    error: e,
                    item,
                    value: undefined,
                    keyParts: attribution.keyParts,
                    pathRelative: attribution.pathRelative,
                    issues,
                    signal: options.signal,
                });
                pathCount = 1;
                pathFailed = true;
            }

            for (const key of keys) {
                // Declared outside the `try` so the catch can attribute a
                // pre-dispatch throw: `plan` is `undefined` when
                // `prepareMountKey` itself threw, and `value` is whatever the
                // read managed to produce.
                let plan: MountKeyPlan | undefined;
                let value: unknown;

                try {
                    plan = this.prepareMountKey(item, key, options, pathsToInclude, pathsToExclude);

                    if (key.length > 0) {
                        value = hasOwnProperty(output, key) ?
                            output[key] :
                            getPathValue(data, key);
                    } else {
                        value = data;
                    }

                    if (plan.filter.skip) {
                        continue;
                    }

                    const optional = this.resolveOptionalDirective(item, value, options);

                    if (optional.skip) {
                        if (optional.write) {
                            output[key] = optional.value;
                        }
                    } else if (item.type === 'container') {
                        const child = item.data;
                        const childInput = isObject(value) ? value : {};
                        const childOptions = this.buildChildRunOptions(options, key, plan, pathsStrict);

                        const tmp: Record<string, any> = yield* op(
                            () => child.run(childInput, childOptions),
                            () => {
                                const childRunSync = (
                                    child as IContainer<any, any> & {
                                        runSync?: (...args: any[]) => any
                                    }
                                ).runSync;
                                if (typeof childRunSync !== 'function') {
                                    throw new RunSyncViolationError(`runSync: nested container at "${key || '<root>'}" does not implement runSync`);
                                }

                                return childRunSync.call(child, childInput, childOptions);
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
                            const validator = item.data;
                            const ctx = this.buildValidatorContext(key, plan, value, data, options);

                            try {
                                const result = yield* op(
                                    () => validator(ctx),
                                    () => {
                                        const outcome = validator(ctx);
                                        if (isThenable(outcome)) {
                                            throw new RunSyncViolationError(`runSync: validator at "${key || '<root>'}" returned a Promise`);
                                        }
                                        return outcome;
                                    },
                                );
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
                                // Structural throws are graph-level errors, not
                                // validation outcomes — don't pollute the cache with
                                // one the next run might reach through different
                                // mounts.
                                //
                                // Pinned by `cache.spec.ts` → "does not cache a
                                // RunSyncViolationError": drop this guard and a
                                // failed `runSync` poisons the slot, so the next
                                // *async* `run()` replays the violation through
                                // `collectExecutionFailure` — which rethrows it
                                // structurally — instead of succeeding. The same
                                // now holds for `PathsStrictViolationError`, which a
                                // validator driving its own strict child container
                                // can raise and which used to be cached here.
                                //
                                // `runParallel`'s cache-write catch applies the
                                // identical guard — the two sites must agree, or a
                                // shared `ResultCache` handed to both run modes
                                // would replay entries one of them refuses to write.
                                if (!isStructuralThrow(e, options.signal)) {
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
                    const attribution = plan || this.describeKey(key);
                    this.collectExecutionFailure({
                        error: e,
                        item,
                        value,
                        keyParts: attribution.keyParts,
                        pathRelative: attribution.pathRelative,
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
     *
     * Shares every per-key helper with the sequential twin body
     * (`prepareMountKey` / `resolveOptionalDirective` / `buildChildRunOptions` /
     * `buildValidatorContext` / the cache pair) but keeps its own scheduling
     * loop — see the note on {@link Container.runBody} for why it can't be a
     * third twin driver.
     */
    private async runParallel(
        data: ContainerInput<T>,
        options: ContainerRunOptions<T, C>,
    ): Promise<T> {
        const { pathsToInclude, pathsToExclude } = this.resolveContainerFilters(options);
        const pathsStrict = this.resolvePathsStrict(options);
        // Structural pre-flight — throws before any mount's promise is created.
        this.assertPathsStrict(pathsStrict, data, pathsToInclude, pathsToExclude, options.path);

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

            // Same containment as the twin body, and strictly more urgent
            // here: by the time this runs, earlier mounts' promises are
            // already in flight. An escape would leave them unowned as well
            // as dropping their issues — see {@link Container.ownRejection}.
            let keys: string[] = [];
            try {
                keys = item.path ? expandPath(data, item.path) : [''];
            } catch (e) {
                const attribution = this.describeKey(item.path || '');
                tasks.push({
                    key: item.path || '',
                    keyParts: attribution.keyParts,
                    pathRelative: attribution.pathRelative,
                    value: undefined,
                    promise: this.ownRejection(Promise.reject(e)),
                    kind: item.type,
                });
            }

            for (const key of keys) {
                // See the twin body's copy of this block: `plan` stays
                // `undefined` when `prepareMountKey` itself threw, and the
                // catch below turns any pre-dispatch throw into a rejected
                // task instead of letting it escape the scheduling loop.
                let plan: MountKeyPlan | undefined;
                let value: unknown;
                let promise: Promise<unknown>;

                try {
                    plan = this.prepareMountKey(item, key, options, pathsToInclude, pathsToExclude);

                    if (key.length > 0) {
                        // Parallel mode reads `data` only — `output[key]` from a
                        // sibling mount is intentionally NOT consulted (the
                        // sibling may not have completed yet).
                        value = getPathValue(data, key);
                    } else {
                        value = data;
                    }

                    if (plan.filter.skip) {
                        continue;
                    }

                    const optional = this.resolveOptionalDirective(item, value, options);
                    if (optional.skip) {
                        if (optional.write) {
                            output[key] = optional.value;
                        }
                        syncPathCount++;
                        continue;
                    }

                    promise = this.ownRejection(
                        this.dispatchParallelMount(item, key, plan, value, data, options, pathsStrict),
                    );
                } catch (e) {
                    // Materialized as a rejected task so the single merge loop
                    // below folds pre-dispatch and validator failures through
                    // the same `collectExecutionFailure` path, preserving both
                    // registration order and the sibling mounts' issues.
                    promise = this.ownRejection(Promise.reject(e));
                }

                const attribution = plan || this.describeKey(key);
                tasks.push({
                    key,
                    keyParts: attribution.keyParts,
                    pathRelative: attribution.pathRelative,
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

    /**
     * Claim ownership of a scheduled mount's rejection.
     *
     * `runParallel` creates every mount's promise eagerly and only attaches
     * `Promise.allSettled` after the whole scheduling loop has run. Any
     * rejection settling in that window — or, worse, any throw that escapes
     * the loop before `allSettled` is reached at all — is unowned, and Node's
     * default `--unhandled-rejections=throw` (this package requires Node >=
     * 24) terminates the process.
     *
     * The no-op subscriber below is a *second* consumer, discarded
     * immediately; the original promise is returned unchanged, so
     * `Promise.allSettled` still observes the real settlement and no outcome
     * is swallowed.
     */
    private ownRejection<P extends Promise<unknown>>(promise: P): P {
        promise.catch(() => { /* ownership only — see doc comment */ });

        return promise;
    }

    /**
     * Create the in-flight promise for one scheduled mount. Extracted from
     * `runParallel`'s scheduling loop so the loop body reads as
     * "resolve, gate, dispatch" and the pre-dispatch `try` stays legible.
     */
    private dispatchParallelMount(
        item: Mount<C>,
        key: string,
        plan: MountKeyPlan,
        value: unknown,
        data: ContainerInput<T>,
        options: ContainerRunOptions<T, C>,
        pathsStrict: boolean,
    ): Promise<unknown> {
        if (item.type === 'container') {
            return item.data.run(
                isObject(value) ? value : {},
                this.buildChildRunOptions(options, key, plan, pathsStrict, true),
            );
        }

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
            return cached.ok ?
                Promise.resolve(cached.value) :
                Promise.reject(cached.error);
        }
        // Wrap sync validators in a microtask so the surrounding
        // `Promise.allSettled` always sees a thenable. Cache writes happen
        // inside the wrapper so the entry is persisted before the promise
        // settles.
        const validator = item.data;
        const ctx = this.buildValidatorContext(key, plan, value, data, options);

        return (async () => {
            try {
                const result = await validator(ctx);
                this.writeCachedOutcome(
                    item,
                    key,
                    snapshot,
                    { ok: true, value: result },
                    options.cache,
                    options.signal,
                );
                return result;
            } catch (e) {
                // Structural violations are not validation outcomes — the
                // validator graph is wrong, not the input — so they must not
                // be remembered and replayed on a later hit. The twin body
                // carves out the same class of throw at its own cache-write
                // site; this one previously had no filter at all, so a
                // `RunSyncViolationError` or `PathsStrictViolationError`
                // raised by a validator driving its own child container was
                // cached and replayed.
                if (!isStructuralThrow(e, options.signal)) {
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
        })();
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
        return runTwinSync(this.runBody(data, options));
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
     * Resolve everything a single `(mount, expanded key)` pair needs before
     * dispatch: the split path parts, the absolute path handed to validators
     * and child containers, and the include/exclude verdict.
     *
     * Shared verbatim by the twin body and `runParallel`. The mount's input
     * `value` is deliberately NOT read here — see {@link MountKeyPlan}.
     */
    private prepareMountKey(
        item: Mount<C>,
        key: string,
        options: ContainerRunOptions<T, C>,
        pathsToInclude: string[] | undefined,
        pathsToExclude: string[] | undefined,
    ): MountKeyPlan {
        const keyParts = key ? pathToArray(key) : [];

        return {
            keyParts,
            pathRelative: keyParts.at(-1),
            pathAbsolute: [
                ...(options.path ? options.path : []),
                ...keyParts,
            ],
            filter: resolvePathFilter(
                pathsToInclude,
                pathsToExclude,
                key,
                item.type === 'container',
            ),
        };
    }

    /**
     * Resolve the optional gate and — when it fires — what (if anything) the
     * skipped key contributes to the output.
     *
     * `optional` is the gate ("may this mount be skipped?"); `optionalValue` is
     * the definition of absent, resolved mount → run → container. A predicate
     * `optional` wins over the atom vocabulary entirely.
     *
     * The write directive follows the same three layers, but keys off
     * `optionalAs` **presence** rather than its value — `{ optionalAs:
     * undefined }` at any layer is a deliberate "emit `undefined`". Only when
     * no layer declares `optionalAs` does the mount-level `optionalInclude`
     * fallback (copy the input through) apply.
     */
    private resolveOptionalDirective(
        item: Mount<C>,
        value: unknown,
        options: ContainerRunOptions<T, C>,
    ): OptionalDirective {
        const resolvedOptionalValue = item.options.optionalValue ??
            options.optionalValue ??
            this.options.optionalValue;
        const isOptional = typeof item.options.optional === 'function' ?
            item.options.optional(value) :
            item.options.optional &&
                isOptionalValue(value, resolvedOptionalValue);

        if (!isOptional) {
            return { skip: false, write: false };
        }

        let write = true;
        let writeValue: unknown;
        if (hasOwnProperty(item.options, 'optionalAs')) {
            writeValue = item.options.optionalAs;
        } else if (hasOwnProperty(options, 'optionalAs')) {
            writeValue = options.optionalAs;
        } else if (hasOwnProperty(this.options, 'optionalAs')) {
            writeValue = this.options.optionalAs;
        } else if (item.options.optionalInclude) {
            writeValue = value;
        } else {
            write = false;
        }

        return {
            skip: true,
            write,
            value: writeValue,
        };
    }

    /**
     * Re-resolve a mount's `optional` declaration for the `meta.optional`
     * stamp applied by {@link Container.collectExecutionFailure}.
     *
     * Split out from `resolveOptionalDirective` because the two calls answer
     * different questions at different times: the directive decides whether to
     * *run* the mount, this decides whether to *tag* the mount's issues. The
     * split is what lets this one contain a throw the gate cannot.
     *
     * A predicate that throws degrades to `false` (don't tag) rather than
     * propagating. This is load-bearing, not defensive: the caller is a
     * `catch` handler with no `try` above it inside the run loop, and the very
     * throw it is folding may be the predicate's own. Re-raising here escapes
     * the error path entirely, discarding **every issue collected so far** and
     * replacing them with one path-less item — so a mainstream idiom like
     * `optional: (v) => v.trim().length === 0` would, on the first absent
     * field, wipe out every other field's validation error.
     *
     * `false` is the conservative fallback: the mount's issues surface at full
     * severity instead of being downgraded to a warning by consumers such as
     * `@validup/vue`'s `getSeverity`. The predicate's failure is not swallowed
     * — it is already being folded into an issue by the caller.
     */
    private resolveOptionalStamp(item: Mount<C>, value: unknown): boolean {
        if (typeof item.options.optional === 'function') {
            try {
                return Boolean(item.options.optional(value));
            } catch {
                return false;
            }
        }

        return item.options.optional === true;
    }

    /**
     * Attribution fallback for a throw raised before a {@link MountKeyPlan}
     * exists — path expansion, key preparation, or the mount's value read.
     *
     * Produces the same `keyParts` / `pathRelative` pair `prepareMountKey`
     * would have, so a pre-dispatch failure is attributed to the mount that
     * caused it rather than surfacing path-less. For an item-level failure
     * (path expansion) the caller passes the *unexpanded* mount path, so a
     * glob mount is identified by its literal pattern (`items.*.name`) — the
     * keys it would have expanded to are precisely what could not be computed.
     */
    private describeKey(key: string): {
        keyParts: PropertyKey[],
        pathRelative: PropertyKey | undefined,
    } {
        const keyParts: PropertyKey[] = key ? pathToArray(key) : [];

        return { keyParts, pathRelative: keyParts.at(-1) };
    }

    /**
     * Build the option bag forwarded into a nested container's `run` /
     * `runSync`. Single source of truth for what a child inherits, so a new
     * run option is threaded downward in one place instead of three.
     */
    private buildChildRunOptions(
        options: ContainerRunOptions<T, C>,
        key: string,
        plan: MountKeyPlan,
        pathsStrict: boolean,
        parallel = false,
    ): ContainerRunOptions<any, C> {
        return {
            group: options.group,
            flat: true,
            path: plan.pathAbsolute,
            pathsToInclude: plan.filter.pathsToInclude,
            pathsToExclude: plan.filter.pathsToExclude,
            // Not forwarded into keyless (`key === ''`) children: they share
            // the parent namespace and receive the filter list verbatim, so
            // strict there would throw for paths owned by the parent's own
            // sibling mounts. Keyless subtrees are a deliberate strict blind
            // spot.
            ...(pathsStrict && key.length > 0 ? { pathsStrict: true } : {}),
            defaults: resolveDefaults(options.defaults, key),
            context: options.context,
            signal: options.signal,
            cache: options.cache,
            ...(parallel ? { parallel: true } : {}),
            optionalValue: options.optionalValue,
            // Presence, not value — see `resolveOptionalDirective`. The child
            // must see the layer's intent (emit-undefined vs. not-set) verbatim.
            ...(hasOwnProperty(options, 'optionalAs') ?
                { optionalAs: options.optionalAs } : {}),
        };
    }

    /**
     * Build the context object handed to a mounted validator.
     */
    private buildValidatorContext(
        key: string,
        plan: MountKeyPlan,
        value: unknown,
        data: ContainerInput<T>,
        options: ContainerRunOptions<T, C>,
    ): ValidatorContext<C> {
        return {
            key,
            path: plan.pathAbsolute,

            value,
            data: data as Record<string, any>,
            group: options.group,
            context: options.context as C,
            signal: options.signal,
            cache: options.cache,
        };
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
     * Resolve the effective `pathsStrict` flag. Run-level wins over
     * container-level; unset anywhere is `false` (the silent, back-compatible
     * default).
     */
    private resolvePathsStrict(options: ContainerRunOptions<T, C>): boolean {
        return options.pathsStrict ?? this.options.pathsStrict ?? false;
    }

    /**
     * Structural pre-flight for `pathsStrict`. Verifies every resolved
     * `pathsToInclude` / `pathsToExclude` entry is satisfied by *this*
     * container — either an exact match against an expanded mount key, or a
     * prefix descent into a container mount (whose child re-checks the
     * forwarded remainder, since `pathsStrict` threads downward). Anything
     * unmatched throws {@link PathsStrictViolationError} with absolute paths.
     *
     * No-ops unless strict is on AND at least one filter list is present, so
     * the overhead on the common (non-strict) path is a single `??` chain.
     *
     * Notes on the match rules (kept in lockstep with `resolvePathFilter`):
     * - Keyless container mounts share the parent namespace and receive the
     *   filter list verbatim, so a path could be owned by the keyless child
     *   OR by a keyed sibling here — the parent can't tell without recursing.
     *   To avoid false positives it treats every entry as satisfied when any
     *   keyless container is present, and `pathsStrict` is NOT forwarded into
     *   keyless children (that would throw for parent-sibling paths). Net:
     *   keyless subtrees are a strict blind spot ("out of scope" per the issue).
     * - Group filtering is intentionally ignored: a mount excluded from the
     *   active group still exists, so a path targeting it is not "stale".
     * - Expansion uses the same `expandPath(data, item.path)` the run loop
     *   uses, so glob mounts are matched against the keys they actually
     *   expand to for the given `data`.
     */
    private assertPathsStrict(
        strict: boolean,
        data: ContainerInput<T>,
        pathsToInclude: string[] | undefined,
        pathsToExclude: string[] | undefined,
        parentPath: PropertyKey[] | undefined,
    ): void {
        if (!strict) {
            return;
        }
        const hasInclude = typeof pathsToInclude !== 'undefined' && pathsToInclude.length > 0;
        const hasExclude = typeof pathsToExclude !== 'undefined' && pathsToExclude.length > 0;
        if (!hasInclude && !hasExclude) {
            return;
        }

        const expanded: { keys: string[], isContainer: boolean }[] = [];
        let hasKeylessContainer = false;
        for (const item of this.items) {
            const keys: string[] = item.path ? expandPath(data, item.path) : [''];
            const itemIsContainer = item.type === 'container';
            if (itemIsContainer && keys.some((key) => key.length === 0)) {
                hasKeylessContainer = true;
            }
            expanded.push({ keys, isContainer: itemIsContainer });
        }

        const isSatisfied = (path: string): boolean => {
            // A keyless container forwards the whole filter list verbatim, so
            // the remainder is strict-checked inside that child — treat every
            // entry as locally satisfied to avoid a false positive here.
            if (hasKeylessContainer) {
                return true;
            }
            for (const entry of expanded) {
                for (const key of entry.keys) {
                    if (key.length === 0) {
                        continue;
                    }
                    if (path === key) {
                        return true;
                    }
                    if (entry.isContainer && path.startsWith(`${key}.`)) {
                        return true;
                    }
                }
            }
            return false;
        };

        const toAbsolute = (path: string): string => {
            if (!parentPath || parentPath.length === 0) {
                return path;
            }
            return stringifyPath([...parentPath, ...pathToArray(path)]);
        };

        const unmatchedInclude = hasInclude ?
            pathsToInclude!.filter((path) => !isSatisfied(path)).map(toAbsolute) :
            [];
        const unmatchedExclude = hasExclude ?
            pathsToExclude!.filter((path) => !isSatisfied(path)).map(toAbsolute) :
            [];

        if (unmatchedInclude.length > 0 || unmatchedExclude.length > 0) {
            throw new PathsStrictViolationError({
                pathsToInclude: unmatchedInclude,
                pathsToExclude: unmatchedExclude,
            });
        }
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

        // Cancellation and structural graph violations are not validation
        // outcomes — surface them verbatim rather than burying them under a
        // generic "Property X is invalid". See {@link isStructuralThrow} for
        // why each of the three legs is carved out.
        if (isStructuralThrow(error, signal)) {
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
        //    current value and tag iff it returns truthy. The run loop
        //    normally only enters this error path when the predicate
        //    returned false (otherwise the validator would have been
        //    skipped), so this branch is usually "don't tag" — but the
        //    explicit re-evaluation keeps the code's intent self-evident
        //    and decouples it from that invariant. The one case where the
        //    predicate did NOT return false is when it *threw*, which is
        //    why the re-invocation is contained — see
        //    {@link Container.resolveOptionalStamp}.
        // - `optional: undefined` → don't tag
        //
        // Per the "no inheritance" decision: issues bubbled up unchanged from
        // a child Container's own `ValidupError` are NOT stamped here — the
        // child's own per-mount tagging is authoritative, and a leaf inside a
        // required-on-its-own-mount field stays unmarked even if its parent
        // mount was optional. This matches the "if you DO provide a role, the
        // role's required fields are still required" semantics.
        const isOptionalMount = this.resolveOptionalStamp(item, value);
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
                const prefixed = prefixIssuePath(error.issues[i], keyParts);
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
        // Cancellation and structural graph violations propagate instead of
        // being reshaped into a path-less `Result.failure` — the exact same
        // decision `collectExecutionFailure` makes. See
        // {@link isStructuralThrow} for the per-leg rationale.
        if (isStructuralThrow(e, options.signal)) {
            throw e;
        }

        // Identity passthrough — deliberately NOT routed through
        // `errorToIssues`. That helper spreads `issues` into a plain array,
        // and rebuilding a `ValidupError` around it would drop the subclass,
        // `cause`, and any custom property the thrower attached. `safeRun`
        // hands back the exact object `run` would have thrown.
        if (isValidupError(e)) {
            return { success: false, error: e };
        }

        // Everything else — an `Error`, or a raw `throw` of a string / plain
        // object / `null` — folds through the shared cascade at its defaults
        // (`code: VALUE_INVALID`, `path: []`), which reproduces every issue
        // *value* this site built by hand before, including the verbatim
        // non-empty-string case. One thing did change: `errorToIssues` passes
        // `code` inside the `defineIssueItem` payload rather than letting the
        // factory append it, so the key insertion order is now
        // `type, path, code, message` where this site emitted
        // `type, path, message, code`. Deep-equality is unaffected;
        // `JSON.stringify` bytes are not. That aligns this site with compose's
        // fold sites and leaves `collectExecutionFailure` — which still builds
        // its items by hand — as the odd one out.
        //
        // `path` is empty because the throw escaped the run loop before any
        // mount key was resolved; a *mounted* unit's failure never arrives
        // here (`collectExecutionFailure` folds that one, with the mount path
        // attached — though see its own note: a keyless mount also yields
        // `path: []`).
        //
        // The fold is not defensive-only: reaching it needs no `Container`
        // subclass. The per-mount value read sits outside the per-mount
        // `try`, so a throwing accessor or Proxy trap on the input lands
        // here — see `test/unit/safe-run-error.spec.ts`, which pins every
        // branch including the "non-empty string throw stays verbatim" case
        // and the never-empty `issues` guarantee.
        return { success: false, error: new ValidupError(errorToIssues(e)) };
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
