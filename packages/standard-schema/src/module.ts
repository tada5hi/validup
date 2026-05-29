/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ValidatorContext, ValidatorDescriptor } from 'validup';
import { ValidupError, defineValidator } from 'validup';
import { buildIssuesForStandardSchemaIssues } from './error';

type StandardSchemaCreateFn<C, S extends StandardSchemaV1> = (
    ctx: ValidatorContext<C>,
) => S;

/**
 * Options accepted by {@link createValidator}.
 */
export type StandardSchemaCreateValidatorOptions = {
    /**
     * Mark the resulting validator as having side effects (network
     * calls, sibling-field reads, observable state) so the framework
     * never caches its outcome. Default `false` — most Standard
     * Schema validators (regex / length / enum / type checks) are
     * deterministic and safe to cache by `(ctx.value, ctx.context,
     * ctx.group)`. Set to `true` for schemas that resolve against
     * external state.
     */
    sideEffect?: boolean,
};

/**
 * Wrap any Standard Schema validator (zod 3.24+, valibot, arktype,
 * effect-schema, …) as a validup `ValidatorDescriptor`. The schema's
 * `~standard.validate` method is invoked with the mounted value; on
 * failure, its issues are translated into validup `IssueItem`s.
 *
 * Pass a function instead of a schema to build per-context schemas
 * (e.g. depending on the active group, sibling values, or
 * `ctx.context`).
 *
 * The returned descriptor infers its `Out` type from the schema's
 * `StandardSchemaV1.InferOutput<S>`, so the builder API
 * (`defineSchema`) picks up real per-field types from any
 * Standard-Schema-compatible library. Returned as a
 * {@link ValidatorDescriptor} so it carries the `sideEffect` flag the
 * validup runtime consults for its result cache.
 */
export function createValidator<
    C = unknown,
    S extends StandardSchemaV1 = StandardSchemaV1,
>(
    input: S | StandardSchemaCreateFn<C, S>,
    options: StandardSchemaCreateValidatorOptions = {},
): ValidatorDescriptor<C, StandardSchemaV1.InferOutput<S>> {
    return defineValidator<C, StandardSchemaV1.InferOutput<S>>({
        sideEffect: options.sideEffect,
        run: async (ctx) => {
            const schema = typeof input === 'function' ? input(ctx) : input;
            const result = await schema['~standard'].validate(ctx.value);

            if (!result.issues) {
                return result.value as StandardSchemaV1.InferOutput<S>;
            }

            throw new ValidupError(buildIssuesForStandardSchemaIssues(result.issues));
        },
    });
}
