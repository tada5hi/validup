/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { GroupKey } from './constants';
import { ValidupNestedError, ValidupValidatorError } from './errors';
import { buildErrorMessageForAttributes, getPropertyPathValue, setPropertyPathValue } from './helpers';
import { expandPropertyPath } from './helpers/expand-property-path';
import type {
    ContainerItem,
    ContainerMountOptions,
    ContainerOptions,
    ContainerRunOptions,
    ObjectPropertyPath,
    ObjectPropertyPathExtended,
    Validator,
} from './types';
import { hasOwnProperty, isObject } from './utils';

export class Container<
    T extends Record<string, any> = Record<string, any>,
> {
    protected options : ContainerOptions<T>;

    protected items : ContainerItem[];

    // ----------------------------------------------

    constructor(options: ContainerOptions<T> = {}) {
        this.options = options;
        this.items = [];
    }

    // ----------------------------------------------

    mount(
        key: ObjectPropertyPathExtended<T>,
        data: Container | Validator
    ) : void;

    mount(
        key: ObjectPropertyPathExtended<T>,
        options: ContainerMountOptions,
        data: Container | Validator
    ) : void;

    mount(...args: any[]) : void {
        if (args.length < 2) {
            throw new SyntaxError('The mount method requires at least');
        }

        const key = args[0];
        let data: Container | Validator;
        let options: ContainerMountOptions = {};

        if (
            args[1] instanceof Container ||
            typeof args[1] === 'function'
        ) {
            [, data] = args;
        } else {
            [, options, data] = args;
        }

        this.items.push({
            ...options,
            data,
            path: key,
        });
    }

    // ----------------------------------------------

    async run(
        data: Record<string, any> = {},
        options: ContainerRunOptions<T> = {},
    ): Promise<T> {
        const output: Record<string, any> = {};

        const errors: ValidupValidatorError[] = [];
        const errorKeys : string[] = [];

        let pathsToInclude : string[] | undefined;
        if (options.pathsToInclude) {
            pathsToInclude = options.pathsToInclude as string[];
        } else if (this.options.pathsToInclude) {
            pathsToInclude = this.options.pathsToInclude as string[];
        }

        let itemCount = 0;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            if (!this.isItemGroupIncluded(item, options.group)) {
                continue;
            }

            let pathsCount = 0;

            const paths = expandPropertyPath(data, item.path, []);
            for (let j = 0; j < paths.length; j++) {
                const path = paths[j];
                const pathAbsolute = this.mergePaths(options.path, paths[j]);

                let value : unknown;
                if (hasOwnProperty(output, path)) {
                    value = output[path];
                } else {
                    value = getPropertyPathValue(data, path);
                }

                if (
                    typeof pathsToInclude !== 'undefined' &&
                    pathsToInclude.indexOf(path) === -1
                ) {
                    continue;
                }

                try {
                    if (item.data instanceof Container) {
                        const tmp = await item.data.run(
                            isObject(value) ? value : {},
                            {
                                group: options.group,
                                flat: true,
                                path: pathAbsolute,
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
                            pathRaw: item.path,

                            pathAbsolute,
                            value,
                            data,
                        });
                    }
                } catch (e) {
                    if (e instanceof ValidupValidatorError) {
                        errors.push(e);
                    } else if (e instanceof ValidupNestedError) {
                        errors.push(...e.children);
                    } else {
                        const error = new ValidupValidatorError({
                            path,
                            pathAbsolute,
                            received: value,
                        });

                        if (e instanceof Error) {
                            error.cause = e;
                            error.message = e.message;
                        }

                        errors.push(error);
                    }

                    errorKeys.push(pathAbsolute);
                }

                pathsCount++;
            }

            if (pathsCount > 0) {
                itemCount++;
            }
        }

        if (this.options.oneOf) {
            if (errors.length === itemCount) {
                throw new ValidupNestedError(buildErrorMessageForAttributes(errorKeys), errors);
            }
        } else if (errors.length > 0) {
            throw new ValidupNestedError(buildErrorMessageForAttributes(errorKeys), errors);
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
            setPropertyPathValue(temp, keys[i], output[keys[i]]);
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

        return !group;
    }

    private mergePaths(...args: (string | undefined)[]) {
        let output : string = '';

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!arg) {
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
}
