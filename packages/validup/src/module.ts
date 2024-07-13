/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidationAttributeError, ValidationNestedError } from './errors';
import { buildErrorMessageForAttributes } from './helpers';
import type {
    Runner, RunnerConfig, ValidatorRunOptions, ValidatorRunnerMountOptions,
} from './types';
import { hasOwnProperty } from './utils';

export class Validator<
    T extends Record<string, any> = Record<string, any>,
> {
    protected items : Record<string, RunnerConfig[]>;

    protected sources : Record<string, Record<string, any>>;

    // ----------------------------------------------

    constructor() {
        this.items = {};
        this.sources = {};
    }

    // ----------------------------------------------

    mountRunner(
        key: keyof T,
        runner: Runner,
        options: ValidatorRunnerMountOptions = {},
    ) {
        let groups : string[] = [];
        if (options.group) {
            if (Array.isArray(options.group)) {
                groups = options.group;
            } else {
                groups = [options.group];
            }
        }

        if (groups.length === 0) {
            groups.push('*');
        }

        for (let i = 0; i < groups.length; i++) {
            if (!this.items[groups[i]]) {
                this.items[groups[i]] = [];
            }

            this.items[groups[i]].push({
                runner,
                key: key as string,
                src: options.src,
            });
        }
    }

    // ----------------------------------------------

    mountSource(key: string, value: Record<string, any>) {
        this.sources[key] = value;
    }

    unmountSource(key: string) {
        delete this.sources[key];
    }

    // ----------------------------------------------

    async run(options: ValidatorRunOptions<T> = {}): Promise<T> {
        const data: Record<string, any> = {};
        const errors: ValidationAttributeError[] = [];
        const errorKeys : string[] = [];

        const items = this.items['*'] || [];
        if (
            options.group &&
            options.group !== '*'
        ) {
            items.push(...this.items[options.group] || []);
        }

        const sourceKeys = Object.keys(this.sources);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            let src : Record<string, any> | undefined;

            if (item.src) {
                const index = sourceKeys.indexOf(item.src);
                if (index !== -1) {
                    const sourceKey = sourceKeys[index];
                    if (hasOwnProperty(this.sources[sourceKey], item.key)) {
                        src = this.sources[sourceKey];
                    }
                } else if (options.data && hasOwnProperty(options.data, item.key)) {
                    src = options.data;
                }
            } else if (options.data && hasOwnProperty(options.data, item.key)) {
                src = options.data;
            } else {
                for (let j = 0; j < sourceKeys.length; j++) {
                    if (hasOwnProperty(this.sources[sourceKeys[j]], item.key)) {
                        src = this.sources[sourceKeys[j]];
                        break;
                    }
                }
            }

            const value = src ? src[item.key] : undefined;

            try {
                data[item.key] = await item.runner({
                    key: item.key,
                    value,
                    src: src || {},
                });
            } catch (e) {
                if (e instanceof ValidationAttributeError) {
                    errors.push(e);
                } else if (e instanceof ValidationNestedError) {
                    errors.push(...e.children);
                } else {
                    const error = new ValidationAttributeError({
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

        if (errors.length > 0) {
            throw new ValidationNestedError(buildErrorMessageForAttributes(errorKeys), errors);
        }

        if (options.defaults) {
            const defaultKeys = Object.keys(options.defaults);
            for (let i = 0; i < defaultKeys.length; i++) {
                if (
                    !hasOwnProperty(data, defaultKeys[i]) ||
                    typeof data[defaultKeys[i]] === 'undefined'
                ) {
                    data[defaultKeys[i]] = options.defaults[defaultKeys[i]];
                }
            }
        }

        return data as T;
    }
}
