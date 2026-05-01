/*
 * Copyright (c) 2024-2025.
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
import { GroupKey } from '../constants';
import { ValidupError, isError, isValidupError } from '../error';
import {
    buildErrorMessageForAttribute,
    isOptionalValue,
    resolveDefaults,
    resolvePathFilter,
} from '../helpers';
import type { Validator } from '../types';
import { hasOwnProperty, isObject } from '../utils';
import { isContainer } from './check';
import type {
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
        data: IContainer<any, any> | Validator<C>
    ) : void;

    mount(
        key: Path<T> | (string & {}),
        options: MountOptions,
        data: IContainer<any, any> | Validator<C>
    ) : void;

    mount(...args: any[]) : void {
        if (args.length < 1) {
            throw new SyntaxError('The mount method requires at least one argument');
        }

        let path : string | undefined;

        let data: IContainer<any, any> | Validator<C> | undefined;
        let dataIsContainer : boolean = false;

        let options: MountOptions = {};

        for (const arg of args) {
            if (typeof arg === 'string') {
                path = arg;
                continue;
            }

            if (typeof arg === 'function') {
                data = arg;
                continue;
            }

            if (isContainer(arg)) {
                data = arg;
                dataIsContainer = true;
                continue;
            }

            if (isObject(arg)) {
                options = arg;
            }
        }

        if (
            !dataIsContainer &&
            (typeof path === 'undefined' || path.length === 0)
        ) {
            throw new SyntaxError('Only a container can be mounted without a key.');
        }

        if (typeof data === 'undefined') {
            throw new SyntaxError('No container/validator could be extracted from the fn arguments.');
        }

        if (isContainer(data)) {
            this.items.push({
                options,
                data,
                path,
                type: 'container',
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
     * @throws ValidupError
     *
     * @param data
     * @param options
     */
    async run(
        data: Record<string, any> = {},
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
                            },
                        );

                        const tmpKeys = Object.keys(tmp);
                        for (const tmpKey of tmpKeys) {
                            output[this.mergePaths(key, tmpKey)] = tmp[tmpKey];
                        }
                    } else if (item.type === 'validator') {
                        output[key] = await item.data({
                            key,
                            path: pathAbsolute,

                            value,
                            data,
                            group: options.group,
                            context: options.context as C,
                            signal: options.signal,
                        });
                    }
                } catch (e) {
                    this.recordMountError(e, item, keyParts, pathRelative, issues, options.signal);
                    pathFailed = true;
                }

                pathCount++;
            }

            if (pathCount > 0) {
                itemCount++;

                if (pathFailed) {
                    errorCount++;
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
        data: Record<string, any>,
        options: ContainerRunOptions<T, C>,
    ): Promise<T> {
        const { pathsToInclude, pathsToExclude } = this.resolveContainerFilters(options);

        const output: Record<string, any> = {};
        const issues: Issue[] = [];

        type KeyTask = {
            key: string,
            keyParts: PropertyKey[],
            pathRelative: PropertyKey | undefined,
            promise: Promise<unknown>,
            kind: 'container' | 'validator',
        };

        type ItemGroup = {
            item: Mount<C>,
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
                        },
                    );
                } else {
                    // Wrap sync validators in a microtask so the surrounding
                    // `Promise.allSettled` always sees a thenable.
                    const itemData = item.data;
                    promise = (async () => itemData({
                        key,
                        path: pathAbsolute,
                        value,
                        data,
                        group: options.group,
                        context: options.context as C,
                        signal: options.signal,
                    }))();
                }

                tasks.push({
                    key,
                    keyParts,
                    pathRelative,
                    promise,
                    kind: item.type,
                });
            }

            if (tasks.length > 0 || syncPathCount > 0) {
                itemGroups.push({
                    item, 
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

        let itemCount = 0;
        let errorCount = 0;

        for (const [i, {
            item, 
            tasks, 
            syncPathCount, 
        }] of itemGroups.entries()) {
            const settled = settledByGroup[i];

            let pathFailed = false;
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
                    this.recordMountError(
                        result.reason,
                        item,
                        task.keyParts,
                        task.pathRelative,
                        issues,
                        options.signal,
                    );
                    pathFailed = true;
                }
            }

            if (tasks.length + syncPathCount > 0) {
                itemCount++;
                if (pathFailed) {
                    errorCount++;
                }
            }
        }

        return this.finalizeOutput(output, options, issues, errorCount, itemCount);
    }

    async safeRun(input: Record<string, any> = {}, options: ContainerRunOptions<T, C> = {}): Promise<Result<T>> {
        try {
            const data = await this.run(input, options);
            return { success: true, data };
        } catch (e) {
            return this.wrapSafeRunError(e, options);
        }
    }

    /**
     * @throws ValidupError
     *
     * Synchronous variant of `run()`. Throws synchronously if any validator
     * returns a thenable, or if a nested container does not implement
     * `runSync`. Use it for purely synchronous validator graphs where the
     * microtask overhead of `await` per mount matters (e.g. driving a
     * reactive UI without a `pending` flicker).
     */
    runSync(
        data: Record<string, any> = {},
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
                        });

                        const tmpKeys = Object.keys(tmp);
                        for (const tmpKey of tmpKeys) {
                            output[this.mergePaths(key, tmpKey)] = tmp[tmpKey];
                        }
                    } else if (item.type === 'validator') {
                        const result = item.data({
                            key,
                            path: pathAbsolute,

                            value,
                            data,
                            group: options.group,
                            context: options.context as C,
                            signal: options.signal,
                        });
                        if (
                            result !== null &&
                            typeof result === 'object' &&
                            typeof (result as { then?: unknown }).then === 'function'
                        ) {
                            throw new RunSyncViolationError(`runSync: validator at "${key || '<root>'}" returned a Promise`);
                        }
                        output[key] = result;
                    }
                } catch (e) {
                    this.recordMountError(e, item, keyParts, pathRelative, issues, options.signal);
                    pathFailed = true;
                }

                pathCount++;
            }

            if (pathCount > 0) {
                itemCount++;

                if (pathFailed) {
                    errorCount++;
                }
            }
        }

        return this.finalizeOutput(output, options, issues, errorCount, itemCount);
    }

    safeRunSync(input: Record<string, any> = {}, options: ContainerRunOptions<T, C> = {}): Result<T> {
        try {
            const data = this.runSync(input, options);
            return { success: true, data };
        } catch (e) {
            return this.wrapSafeRunError(e, options);
        }
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
     * Translate a per-mount throw into accumulated `issues`. Re-throws when
     * the run was aborted (signal-aware validators) so abort errors are not
     * mangled into validation issues. `keyParts` is the current mount's
     * expanded path (used to prepend to nested `ValidupError` issues).
     */
    private recordMountError(
        e: unknown,
        item: Mount<C>,
        keyParts: PropertyKey[],
        pathRelative: PropertyKey | undefined,
        issues: Issue[],
        signal: AbortSignal | undefined,
    ): void {
        if (signal?.aborted) {
            throw e;
        }
        // Structural runSync violations are not validation outcomes — they
        // mean the caller can't use runSync against this graph. Surface the
        // diagnostic verbatim instead of wrapping it as "Property X is invalid".
        if (isRunSyncViolation(e)) {
            throw e;
        }

        const childIssues: Issue[] = [];

        if (isValidupError(e)) {
            for (let i = 0; i < e.issues.length; i++) {
                const issue = e.issues[i];

                childIssues.push({
                    ...issue,
                    path: [
                        ...keyParts,
                        ...(issue.path || []),
                    ],
                });
            }
        } else if (isError(e)) {
            childIssues.push(defineIssueItem({
                path: keyParts,
                message: e.message,
            }));
        }

        if (pathRelative) {
            if (item.type === 'container' || childIssues.length > 1) {
                issues.push(defineIssueGroup({
                    message: buildErrorMessageForAttribute(String(pathRelative)),
                    params: { name: String(pathRelative) },
                    path: keyParts,
                    issues: childIssues,
                }));
            } else {
                issues.push(...childIssues);
            }
        } else {
            issues.push(...childIssues);
        }
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
            if (errorCount === itemCount) {
                const group = defineIssueGroup({
                    code: IssueCode.ONE_OF_FAILED,
                    message: 'None of the branches succeeded',
                    issues,
                    path: options.path ? options.path : [],
                });
                throw new ValidupError([group]);
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

        return { success: false, error: new ValidupError() };
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
