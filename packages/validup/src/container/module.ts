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
import { buildErrorMessageForAttribute, isOptionalValue } from '../helpers';
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

type PathFilterResolution = {
    skip: boolean,
    pathsToInclude: string[] | undefined,
    pathsToExclude: string[] | undefined,
};

/**
 * Resolve `pathsToInclude` / `pathsToExclude` against a single mounted item's
 * (already-expanded) local `key`. Returns whether to skip the item, plus the
 * filter sub-lists to forward into a child container — with the parent prefix
 * stripped so the child can match purely against its own local keys.
 *
 * Semantics:
 * - Un-keyed container mount (`key === ''`) shares the parent's namespace, so
 *   filters are forwarded verbatim.
 * - Exact match in `pathsToInclude` / `pathsToExclude` matches the whole mount.
 * - Prefix match (`<key>.…`) only descends into container mounts; leaf
 *   validators with deeper-target filters fall through (skipped for include,
 *   kept for exclude).
 */
function resolvePathFilter(
    pathsToInclude: string[] | undefined,
    pathsToExclude: string[] | undefined,
    key: string,
    isContainer: boolean,
): PathFilterResolution {
    if (key.length === 0) {
        return {
            skip: false, 
            pathsToInclude, 
            pathsToExclude, 
        };
    }

    let includeForward: string[] | undefined;
    if (typeof pathsToInclude !== 'undefined') {
        let exact = false;
        const stripped: string[] = [];
        for (const path of pathsToInclude) {
            if (path === key) {
                exact = true;
            } else if (isContainer && path.startsWith(`${key}.`)) {
                stripped.push(path.slice(key.length + 1));
            }
        }
        if (exact) {
            includeForward = undefined;
        } else if (stripped.length > 0) {
            includeForward = stripped;
        } else {
            return {
                skip: true, 
                pathsToInclude: undefined, 
                pathsToExclude: undefined, 
            };
        }
    }

    let excludeForward: string[] | undefined;
    if (typeof pathsToExclude !== 'undefined') {
        const stripped: string[] = [];
        for (const path of pathsToExclude) {
            if (path === key) {
                return {
                    skip: true, 
                    pathsToInclude: undefined, 
                    pathsToExclude: undefined, 
                };
            }
            if (isContainer && path.startsWith(`${key}.`)) {
                stripped.push(path.slice(key.length + 1));
            }
        }
        if (stripped.length > 0) {
            excludeForward = stripped;
        }
    }

    return {
        skip: false, 
        pathsToInclude: includeForward, 
        pathsToExclude: excludeForward, 
    };
}

export class Container<
    T extends Record<string, any> = Record<string, any>,
> implements IContainer {
    protected options : ContainerOptions<T>;

    protected items : Mount[];

    // ----------------------------------------------

    constructor(options: ContainerOptions<T> = {}) {
        this.options = options;
        this.items = [];

        this.initialize();
    }

    // ----------------------------------------------

    mount(container: IContainer) : void;

    mount(
        options: MountOptions,
        container: IContainer
    ): void;

    mount(
        key: Path<T> | (string & {}),
        data: IContainer | Validator
    ) : void;

    mount(
        key: Path<T> | (string & {}),
        options: MountOptions,
        data: IContainer | Validator
    ) : void;

    mount(...args: any[]) : void {
        if (args.length < 1) {
            throw new SyntaxError('The mount method requires at least one argument');
        }

        let path : string | undefined;

        let data: IContainer | Validator | undefined;
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
            data,
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
        options: ContainerRunOptions<T> = {},
    ): Promise<T> {
        let pathsToInclude : string[] | undefined;
        if (options.pathsToInclude) {
            pathsToInclude = options.pathsToInclude as string[];
        } else if (this.options.pathsToInclude) {
            pathsToInclude = this.options.pathsToInclude as string[];
        }

        let pathsToExclude : string[] | undefined;
        if (options.pathsToExclude) {
            pathsToExclude = options.pathsToExclude as string[];
        } else if (this.options.pathsToExclude) {
            pathsToExclude = this.options.pathsToExclude as string[];
        }

        const output: Record<string, any> = {};

        const issues : Issue[] = [];

        let itemCount : number = 0;
        let errorCount : number = 0;

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            if (!this.isItemGroupIncluded(item, options.group)) {
                // todo: maybe add issue info
                continue;
            }

            let pathCount = 0;
            let pathFailed = false;

            let keys : string[];
            if (item.path) {
                keys = expandPath(data, item.path);
            } else {
                keys = [''];
            }

            for (const key of keys) {
                const keyParts = key ? pathToArray(key) : [];

                const pathRelative = keyParts.at(-1);
                const pathAbsolute = [
                    ...(options.path ? options.path : []),
                    ...keyParts,
                ];

                let value : unknown;
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
                    // todo: maybe add issue info
                    continue;
                }

                try {
                    if (
                        item.options.optional &&
                        isOptionalValue(value, item.options.optionalValue)
                    ) {
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
                                // todo: extract defaults for container
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
                        });
                    }
                } catch (e) {
                    const childIssues : Issue[] = [];

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
                            const group = defineIssueGroup({
                                message: buildErrorMessageForAttribute(pathRelative),
                                path: keyParts,
                                issues: childIssues,
                            });

                            issues.push(group);
                        } else {
                            issues.push(...childIssues);
                        }
                    } else {
                        issues.push(...childIssues);
                    }

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
                    output[defaultKey] = options.defaults[defaultKey as unknown as Path<T>];
                }
            }
        }

        if (options.flat) {
            return output as T;
        }

        const temp : Record<string, any> = {};

        const keys = Object.keys(output);
        for (const key of keys) {
            setPathValue(temp, key, output[key]);
        }

        return temp as T;
    }

    async safeRun(input: Record<string, any> = {}, options: ContainerRunOptions<T> = {}): Promise<Result<T>> {
        try {
            const data = await this.run(input, options);
            return { success: true, data };
        } catch (e) {
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
    }

    private isItemGroupIncluded(
        item: Mount,
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
