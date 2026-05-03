/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Validator, ValidatorContext } from 'validup';
import { ValidupError } from 'validup';
import type { output as ZodOutput, ZodType } from 'zod';
import { buildIssuesForZodError } from './error';

type ZodCreateFn<C, Z extends ZodType> = (ctx: ValidatorContext<C>) => Z;

/**
 * Wrap a zod schema as a validup `Validator`. The returned validator infers
 * its `Out` type from the schema, so the builder API (`defineSchema`) and any
 * caller using the second `Validator<C, Out>` generic see the parsed shape
 * (`z.output<Z>`) rather than `unknown`.
 *
 * Pass a factory `(ctx) => schema` to build per-context schemas.
 */
export function createValidator<
    C = unknown,
    Z extends ZodType = ZodType,
>(input: Z | ZodCreateFn<C, Z>): Validator<C, ZodOutput<Z>> {
    return async (ctx) => {
        const zod = typeof input === 'function' ? input(ctx) : input;

        const outcome = await zod.safeParseAsync(ctx.value);
        if (outcome.success) {
            return outcome.data as ZodOutput<Z>;
        }

        throw new ValidupError(buildIssuesForZodError(outcome.error));
    };
}
