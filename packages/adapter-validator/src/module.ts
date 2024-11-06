/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ContextRunner, FieldValidationError } from 'express-validator';
import { distinctArray } from 'smob';
import type { Validator, ValidatorContext } from 'validup';
import { ValidupError } from 'validup';
import { buildNestedError } from './error';

type ContextRunnerCreateFn = (
    ctx: ValidatorContext
) => ContextRunner;

export function createValidator(
    input: ContextRunnerCreateFn | ContextRunner,
) : Validator {
    return async (ctx): Promise<unknown> => {
        let runner : ContextRunner;
        if (typeof input === 'function') {
            runner = input(ctx);
        } else {
            runner = input;
        }

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
                throw buildNestedError(errors, {
                    path: ctx.path,
                    pathAbsolute: ctx.pathAbsolute,
                });
            }

            return field.value;
        }

        throw new ValidupError(`The attribute ${ctx.path} could not be validated.`);
    };
}
