/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ValidationError as BaseValidationError, FieldValidationError, ValidationChainWithExtensions,
} from 'express-validator';
import type { FieldInstance, Request } from 'express-validator/lib/base';
import type { ReadonlyContext } from 'express-validator/lib/context';
import { distinctArray } from 'smob';
import type { AttributeSource } from './constants';
import { buildFactory } from './factory';
import { ValidationError } from './error';
import { buildErrorMessageForAttributes } from './helpers';
import type {
    Factory,
    ValidationChain, ValidationCompositeChain, ValidatorExecuteOptions, ValidatorRegisterOptions,
} from './types';
import { hasOwnProperty } from './utils';

export class Validator<
    T extends Record<string, any> = Record<string, any>,
> {
    protected items : Record<string, (ValidationChain | ValidationCompositeChain)[]>;

    protected factory : Factory;

    // ----------------------------------------------

    constructor() {
        this.items = {};
        this.factory = buildFactory();
    }

    // ----------------------------------------------

    createChain<A extends keyof T>(
        attribute: A,
        source?: `${AttributeSource}`,
    ) : ValidationChainWithExtensions<any> {
        return this.factory.createChain(attribute as string, source);
    }

    createCompositeChain(
        chains: ValidationChainWithExtensions<any>[],
    ) {
        return this.factory.createCompositeChain(chains);
    }

    // ----------------------------------------------

    registerMany<A extends ValidationChain | ValidationCompositeChain>(
        input: A[],
        options: ValidatorRegisterOptions = {},
    ) {
        for (let i = 0; i < input.length; i++) {
            this.register(input[i], options);
        }
    }

    register<A extends ValidationChain | ValidationCompositeChain>(
        input: A,
        options: ValidatorRegisterOptions = {},
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

            this.items[groups[i]].push(input);
        }
    }

    // ----------------------------------------------

    async execute(
        req: Request,
        options: ValidatorExecuteOptions<T> = {},
    ): Promise<T> {
        const data: Record<string, any> = {};
        const errors: BaseValidationError[] = [];

        const items = this.items['*'] || [];
        if (
            options.group &&
            options.group !== '*'
        ) {
            items.push(...this.items[options.group] || []);
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            const outcome = await item.run(req);
            const fields = outcome.context.getData({ requiredOnly: false });

            for (let i = 0; i < fields.length; i++) {
                const itemErrors = this.extractFieldErrors(fields[i], outcome.context);
                if (itemErrors.length > 0) {
                    errors.push(...itemErrors);
                    continue;
                }

                data[fields[i].path] = fields[i].value;
            }
        }

        if (errors.length > 0) {
            throw this.mergeErrors(distinctArray(errors));
        }

        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const value = data[keys[i]];
            if (typeof value !== 'undefined') {
                continue;
            }

            if (
                options.defaults &&
                hasOwnProperty(options.defaults, keys[i])
            ) {
                data[keys[i]] = options.defaults[keys[i]];
                continue;
            }

            delete data[keys[i]];
        }

        return data as T;
    }

    protected extractFieldErrors(field: FieldInstance, context: ReadonlyContext) : FieldValidationError[] {
        return context.errors.filter(
            (error) => error.type === 'field' &&
                error.location === field.location &&
                error.path === field.path,
        ) as FieldValidationError[];
    }

    protected mergeErrors(errors: BaseValidationError[]): Error {
        const parameterNames : string[] = [];

        for (let i = 0; i < errors.length; i++) {
            const item = errors[i];

            switch (item.type) {
                case 'field': {
                    parameterNames.push(item.path);
                    break;
                }
                case 'alternative': {
                    parameterNames.push(item.nestedErrors.map(
                        ((el) => el.path),
                    )
                        .join('|'));
                    break;
                }
            }
        }

        throw new ValidationError(buildErrorMessageForAttributes(Array.from(parameterNames)), {
            children: errors,
        });
    }
}
