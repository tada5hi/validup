/*
 * Copyright (c) 2024-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { expandPath, getPathValue, setPathValue } from 'pathtrace';
import { GroupKey } from '../constants';
import { ValidupError } from '../errors';
import { isOptionalValue } from '../helpers';
import type { ObjectPropertyPath, ObjectPropertyPathExtended, Validator } from '../types';
import { hasOwnProperty, isObject } from '../utils';
import { isContainer } from './check';
import type {
    ContainerItem, ContainerMountOptions, ContainerOptions, ContainerRunOptions, IContainer,
} from './types';
import type { Issue } from '../issue';

export class Container<
    T extends Record<string, any> = Record<string, any>,
> implements IContainer {
    protected options : ContainerOptions<T>;

    protected items : ContainerItem[];

    // ----------------------------------------------

    constructor(options: ContainerOptions<T> = {}) {
        this.options = options;
        this.items = [];

        this.initialize();
    }

    // ----------------------------------------------

    mount(container: IContainer) : void;

    mount(
        options: ContainerMountOptions,
        container: IContainer
    ): void;

    mount(
        key: ObjectPropertyPathExtended<T>,
        data: IContainer | Validator
    ) : void;

    mount(
        key: ObjectPropertyPathExtended<T>,
        options: ContainerMountOptions,
        data: IContainer | Validator
    ) : void;

    mount(...args: any[]) : void {
        if (args.length < 1) {
            throw new SyntaxError('The mount method requires at least one argument');
        }

        let path : string | undefined;

        let data: IContainer | Validator | undefined;
        let dataIsContainer : boolean = false;

        let options: ContainerMountOptions = {};

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

        this.items.push({
            ...options,
            data,
            path,
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

        let errors : number = 0;
        const issues : Issue[] = [];

        let itemCount = 0;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            if (!this.isItemGroupIncluded(item, options.group)) {
                // todo: maybe add issue info
                continue;
            }

            let pathsCount = 0;

            let paths : string[];
            if (item.path) {
                paths = expandPath(data, item.path);
            } else {
                paths = [''];
            }

            for (let j = 0; j < paths.length; j++) {
                const path = paths[j];
                const pathAbsolute = this.mergePaths(options.path, paths[j]);

                let value : unknown;
                if (hasOwnProperty(output, path)) {
                    value = output[path];
                } else if (path.length > 0) {
                    value = getPathValue(data, path);
                } else {
                    value = data;
                }

                if (
                    typeof pathsToInclude !== 'undefined' &&
                    pathsToInclude.indexOf(path) === -1
                ) {
                    // todo: maybe add issue info
                    continue;
                }

                if (
                    typeof pathsToExclude !== 'undefined' &&
                    pathsToExclude.indexOf(path) !== -1
                ) {
                    // todo: maybe add issue info
                    continue;
                }

                try {
                    if (
                        item.optional &&
                        isOptionalValue(value, item.optionalValue)
                    ) {
                        if (item.optionalInclude) {
                            output[path] = value;
                        }
                    } else if (isContainer(item.data)) {
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
                            output[this.mergePaths(path, tmpKeys[k])] = tmp[tmpKeys[k]];
                        }
                    } else {
                        output[path] = await item.data({
                            path,
                            pathRaw: item.path ?? '',

                            pathAbsolute,
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
                                    ...(path ? [path] : []),
                                    ...(issue.path || []),
                                ],
                            });
                        }
                    } else if (path) {
                        childIssues.push({
                            message: `The validation of property ${path} failed`,
                            path: [path],
                        });
                    }

                    issues.push(...childIssues);
                    errors++;
                }

                pathsCount++;
            }

            if (pathsCount > 0) {
                itemCount++;
            }
        }

        if (this.options.oneOf) {
            if (errors === itemCount) {
                throw new ValidupError(issues);
            }
        } else if (errors > 0) {
            throw new ValidupError(issues);
        }

        if (options.defaults) {
            const defaultKeys = Object.keys(options.defaults);
            for (let i = 0; i < defaultKeys.length; i++) {
                if (
                    !hasOwnProperty(output, defaultKeys[i]) ||
                    typeof output[defaultKeys[i]] === 'undefined'
                ) {
                    output[defaultKeys[i]] = options.defaults[defaultKeys[i] as unknown as ObjectPropertyPath<T>];
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
        item: ContainerItem,
        group?: string,
    ) : boolean {
        if (group === GroupKey.WILDCARD) {
            return true;
        }

        if (item.group) {
            if (Array.isArray(item.group)) {
                if (item.group.indexOf(GroupKey.WILDCARD) !== -1) {
                    return true;
                }

                if (group && item.group.indexOf(group) !== -1) {
                    return true;
                }
            } else {
                if (item.group === GroupKey.WILDCARD) {
                    return true;
                }

                if (item.group === group) {
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
