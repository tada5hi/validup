/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { body } from 'express-validator';
import type { ContextRunner, FieldValidationError, ValidationChain } from 'express-validator';
import type { FieldInstance } from 'express-validator/lib/base';
import type { ReadonlyContext } from 'express-validator/lib/context';
import { distinctArray } from 'smob';
import type { ValidationRunner } from 'validup';
import { ValidationError } from 'validup';
import { buildError } from './error';

function extractAttributeErrors(
    field: FieldInstance,
    context: ReadonlyContext,
) : FieldValidationError[] {
    return context.errors.filter(
        (error) => error.type === 'field' &&
            error.location === field.location &&
            error.path === field.path,
    ) as FieldValidationError[];
}

type FactoryFn = (chain: ValidationChain) => ContextRunner;

export function createRunner(input: FactoryFn | ContextRunner) : ValidationRunner {
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
            const itemErrors = distinctArray(extractAttributeErrors(field, outcome.context));
            if (itemErrors.length > 0) {
                throw buildError(itemErrors);
            }

            return field.value;
        }

        throw new ValidationError(`The attribute ${ctx.key} could not be validated.`);
    };
}
