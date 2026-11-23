/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidatorDescriptor } from 'validup';
import { ValidupError, defineValidator } from 'validup';
import type { output as ZodOutput, ZodType } from 'zod';
import { $ZodAsyncError } from 'zod/v4/core';
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
 * The parse entry point follows the run mode (`ctx.sync`): under
 * `runSync` / `safeRunSync` the schema is parsed with `safeParse` and the
 * result is returned (or thrown) synchronously; otherwise `safeParseAsync`
 * is used and a promise is returned. A schema that needs async parsing
 * (async refine / transform) cannot run synchronously: in sync mode it
 * yields an already-rejected promise, which the container reports as a
 * structural `RunSyncViolationError` instead of a validation issue.
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
        run: (ctx) => {
            const zod = typeof input === 'function' ? input(ctx) : input;

            type Outcome = ReturnType<Z['safeParse']>;
            const unwrap = (outcome: Outcome): ZodOutput<Z> => {
                if (outcome.success) {
                    return outcome.data as ZodOutput<Z>;
                }

                throw new ValidupError(buildIssuesForZodError(outcome.error, ctx.value));
            };

            if (!ctx.sync) {
                return zod.safeParseAsync(ctx.value)
                    .then((outcome) => unwrap(outcome as Outcome));
            }

            let outcome: Outcome;

            try {
                outcome = zod.safeParse(ctx.value) as Outcome;
            } catch (e) {
                if (e instanceof $ZodAsyncError) {
                    // An async schema cannot be parsed synchronously. Return a
                    // thenable so `runSync` raises its structural
                    // `RunSyncViolationError` (never folded into issues), and
                    // own the rejection here so it is never reported as
                    // unhandled, whatever the caller does with it.
                    const rejected = Promise.reject(e);

                    rejected.catch(() => { /* ownership only */ });

                    return rejected as Promise<ZodOutput<Z>>;
                }

                throw e;
            }

            return unwrap(outcome);
        },
    });
}
export type { ZodCreateValidatorOptions };
