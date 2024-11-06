/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Validator, ValidatorContext } from 'validup';
import type { ZodType } from 'zod';
import { buildError } from './error';

type ZodCreateFn = (ctx: ValidatorContext) => ZodType;

export function createValidator(input: ZodCreateFn | ZodType) : Validator {
    return async (ctx): Promise<unknown> => {
        let zod : ZodType;
        if (typeof input === 'function') {
            zod = input(ctx);
        } else {
            zod = input;
        }

        const outcome = await zod.safeParseAsync(ctx.value);
        if (outcome.success) {
            return outcome.data;
        }

        throw buildError(outcome.error, {
            path: ctx.path,
            pathAbsolute: ctx.pathAbsolute,
        });
    };
}
