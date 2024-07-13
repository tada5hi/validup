/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ContextRunner, FieldValidationError, ValidationChain } from 'express-validator';
import { body } from 'express-validator';
import { distinctArray } from 'smob';
import type { Runner } from 'validup';
import { ValidationError } from 'validup';
import { buildNestedError } from './error';

type FactoryFn = (chain: ValidationChain) => ContextRunner;

export function createRunner(input: FactoryFn | ContextRunner) : Runner {
    let runner : ContextRunner;
    if (typeof input === 'function') {
        runner = input(body());
    } else {
        runner = input;
    }

    return async (ctx): Promise<unknown> => {
        const outcome = await runner.run({
            body: ctx.value,
        });

        const [field] = outcome.context.getData({ requiredOnly: false });
        if (field) {
            const errors = distinctArray(outcome.context.errors.filter(
                (error) => error.type === 'field' &&
                    error.location === field.location &&
                    error.path === field.path,
            ) as FieldValidationError[]);

            if (errors.length > 0) {
                throw buildNestedError(errors, ctx.key);
            }

            return field.value;
        }

        throw new ValidationError(`The attribute ${ctx.key} could not be validated.`);
    };
}
