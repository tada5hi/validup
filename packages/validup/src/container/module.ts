/*
 * Copyright (c) 2024-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Path } from 'pathtrace';
import {
    expandPath, getPathValue, pathToArray, setPathValue,
} from 'pathtrace';
import { GroupKey } from '../constants';
import { ValidupError } from '../errors';
import { isOptionalValue } from '../helpers';
import type { Validator } from '../types';
import { hasOwnProperty, isObject } from '../utils';
import { isContainer } from './check';
import type {
    ContainerOptions, ContainerRunOptions, IContainer, Mount, MountOptions,
} from './types';
import type { Issue } from '../issue';
import { defineIssueGroup, defineIssueItem } from '../issue';

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
        // eslint-disable-next-line @typescript-eslint/ban-types
        key: Path<T> | (string & {}),
        data: IContainer | Validator
    ) : void;

    mount(
        // eslint-disable-next-line @typescript-eslint/ban-types
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

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

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
                options = args[i];
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
        } else if (this.options.pathsToInclude) {
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

            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
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

                if (
                    typeof pathsToInclude !== 'undefined' &&
                    pathsToInclude.indexOf(key) === -1
                ) {
                    // todo: maybe add issue info
                    continue;
                }

                if (
                    typeof pathsToExclude !== 'undefined' &&
                    pathsToExclude.indexOf(key) !== -1
                ) {
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
                                pathsToInclude: options.pathsToInclude,
                                // todo: extract defaults for container
                            },
                        );

                        const tmpKeys = Object.keys(tmp);
                        for (let k = 0; k < tmpKeys.length; k++) {
                            output[this.mergePaths(key, tmpKeys[k])] = tmp[tmpKeys[k]];
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

                    if (e instanceof ValidupError) {
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
                    } else if (e instanceof Error) {
                        childIssues.push(defineIssueItem({
                            path: keyParts,
                            message: e.message,
                        }));
                    }

                    if (pathRelative) {
                        if (childIssues.length > 1 || childIssues.length === 0) {
                            const group = defineIssueGroup({
                                message: `Property ${String(pathRelative)} is invalid`,
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
                    // code: IssueCode.ONE_OF
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
            for (let i = 0; i < defaultKeys.length; i++) {
                if (
                    !hasOwnProperty(output, defaultKeys[i]) ||
                    typeof output[defaultKeys[i]] === 'undefined'
                ) {
                    output[defaultKeys[i]] = options.defaults[defaultKeys[i] as unknown as Path<T>];
                }
            }
        }

        if (options.flat) {
            return output as T;
        }

        const temp : Record<string, any> = {};

        const keys = Object.keys(output);
        for (let i = 0; i < keys.length; i++) {
            setPathValue(temp, keys[i], output[keys[i]]);
        }

        return temp as T;
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
                if (item.options.group.indexOf(GroupKey.WILDCARD) !== -1) {
                    return true;
                }

                if (group && item.options.group.indexOf(group) !== -1) {
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

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
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
