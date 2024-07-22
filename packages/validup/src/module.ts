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
    ContainerItem, ContainerMountOptions, ContainerRunOptions, Validator,
} from './types';
import { hasOwnProperty, isObject } from './utils';

export class Container<
    T extends Record<string, any> = Record<string, any>,
> {
    protected items : ContainerItem[];

    // ----------------------------------------------

    constructor() {
        this.items = [];
    }

    // ----------------------------------------------

    mount(
        key: string,
        data: Container | Validator
    ) : void;

    mount(
        key: string,
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

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            if (!this.isContainerItemGroupIncluded(item, options.group)) {
                continue;
            }

            const keys = expandPropertyPath(data, item.path, []);
            for (let j = 0; j < keys.length; j++) {
                let value : unknown;
                if (hasOwnProperty(output, keys[j])) {
                    value = output[keys[j]];
                } else {
                    value = getPropertyPathValue(data, keys[j]);
                }

                const path = this.mergePaths(options.path, keys[j]);
                const pathRaw = this.mergePaths(options.pathRaw, item.path);

                try {
                    if (item.data instanceof Container) {
                        const tmp = await item.data.run(
                            isObject(value) ? value : {},
                            {
                                group: options.group,
                                flat: true,
                                path,
                                pathRaw,
                                // todo: extract defaults for container
                            },
                        );

                        const tmpKeys = Object.keys(tmp);
                        for (let k = 0; k < tmpKeys.length; k++) {
                            output[this.mergePaths(keys[j], tmpKeys[k])] = tmp[tmpKeys[k]];
                        }
                    } else {
                        output[keys[j]] = await item.data({
                            key: keys[j],
                            path,
                            pathRaw,
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
                            received: value,
                        });

                        if (e instanceof Error) {
                            error.cause = e;
                            error.message = e.message;
                        }

                        errors.push(error);
                    }

                    errorKeys.push(path);
                }
            }
        }

        if (errors.length > 0) {
            throw new ValidupNestedError(buildErrorMessageForAttributes(errorKeys), errors);
        }

        if (options.defaults) {
            const defaultKeys = Object.keys(options.defaults);
            for (let i = 0; i < defaultKeys.length; i++) {
                if (
                    !hasOwnProperty(output, defaultKeys[i]) ||
                    typeof output[defaultKeys[i]] === 'undefined'
                ) {
                    output[defaultKeys[i]] = options.defaults[defaultKeys[i]];
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

    private isContainerItemGroupIncluded(
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
