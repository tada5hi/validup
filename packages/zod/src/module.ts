/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidatorDescriptor } from 'validup';
import { ValidupError, defineValidator } from 'validup';
import type { output as ZodOutput, ZodType } from 'zod';
import { buildIssuesForZodError } from './error';

import type { ZodCreateFn, ZodCreateValidatorOptions } from './types';

/**
 * Options accepted by {@link createValidator}.
 */

/**
 * Wrap a zod schema as a validup `ValidatorDescriptor`. The returned
 * descriptor infers its `Out` type from the schema, so the builder API
 * (`defineSchema`) and any caller using the second `Validator<C, Out>`
 * generic see the parsed shape (`z.output<Z>`) rather than `unknown`.
 *
 * Pass a factory `(ctx) => schema` to build per-context schemas.
 *
 * Returned as a {@link ValidatorDescriptor} (not a bare function) so it
 * can carry the `sideEffect` flag the validup runtime consults for its
 * result cache. Mounts unchanged via the same `container.mount(...)`
 * signatures — bare-function and descriptor inputs are interchangeable
 * at the mount site.
 */
export function createValidator<
    C = unknown,
    Z extends ZodType = ZodType,
>(
    input: Z | ZodCreateFn<C, Z>,
    options: ZodCreateValidatorOptions = {},
): ValidatorDescriptor<C, ZodOutput<Z>> {
    return defineValidator<C, ZodOutput<Z>>({
        sideEffect: options.sideEffect,
        run: async (ctx) => {
            const zod = typeof input === 'function' ? input(ctx) : input;

            const outcome = await zod.safeParseAsync(ctx.value);

            if (outcome.success) {
                return outcome.data as ZodOutput<Z>;
            }

            throw new ValidupError(buildIssuesForZodError(outcome.error, ctx.value));
        },
    });
}
export type { ZodCreateValidatorOptions };
