/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupNestedError, ValidupValidatorError } from './errors';
import { buildErrorMessageForAttributes, getPropertyPathValue, setPropertyPathValue } from './helpers';
import { expandPropertyPath } from './helpers/expand-property-path';
import type {
    ContainerRunOptions, Validator, ValidatorConfig,
} from './types';
import { hasOwnProperty } from './utils';

export class Container<
    T extends Record<string, any> = Record<string, any>,
> {
    protected items : ValidatorConfig[];

    // ----------------------------------------------

    constructor() {
        this.items = [];
    }

    // ----------------------------------------------

    mount(
        key: keyof T,
        validator: Validator,
        options: Omit<ValidatorConfig, 'validator' | 'key'> = {},
    ) {
        this.items.push({
            ...options,
            validator,
            key: key as string,
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

            // Is validator assigned to specific group ?
            if (item.group) {
                if (Array.isArray(item.group)) {
                    if (options.group) {
                        if (item.group.indexOf(options.group) === -1) {
                            continue;
                        }
                    } else {
                        continue;
                    }
                } else if (options.group) {
                    if (item.group !== options.group) {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            const keys = expandPropertyPath(data, item.key, []);
            for (let j = 0; j < keys.length; j++) {
                let value : unknown;
                if (hasOwnProperty(output, keys[j])) {
                    value = output[keys[j]];
                } else {
                    value = getPropertyPathValue(data, keys[j]);
                }

                try {
                    output[keys[j]] = await item.validator({
                        key: keys[j],
                        keyRaw: item.key,
                        value,
                        data,
                    });
                } catch (e) {
                    if (e instanceof ValidupValidatorError) {
                        errors.push(e);
                    } else if (e instanceof ValidupNestedError) {
                        errors.push(...e.children);
                    } else {
                        const error = new ValidupValidatorError({
                            path: item.key,
                            received: value,
                        });

                        if (e instanceof Error) {
                            error.cause = e;
                            error.message = e.message;
                        }

                        errors.push(error);
                    }

                    errorKeys.push(item.key);
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

        if (options.keysFlat) {
            return output as T;
        }

        const temp : Record<string, any> = {};

        const keys = Object.keys(output);
        for (let i = 0; i < keys.length; i++) {
            setPropertyPathValue(temp, keys[i], output[keys[i]]);
        }

        return temp as T;
    }
}
