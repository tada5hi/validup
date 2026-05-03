/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Validator, ValidatorContext } from 'validup';
import { ValidupError } from 'validup';
import { buildIssuesForStandardSchemaIssues } from './error';

type StandardSchemaCreateFn<C, S extends StandardSchemaV1> = (
    ctx: ValidatorContext<C>,
) => S;

/**
 * Wrap any Standard Schema validator (zod 3.24+, valibot, arktype,
 * effect-schema, …) as a validup `Validator`. The schema's `~standard.validate`
 * method is invoked with the mounted value; on failure, its issues are
 * translated into validup `IssueItem`s.
 *
 * Pass a function instead of a schema to build per-context schemas
 * (e.g. depending on the active group, sibling values, or `ctx.context`).
 *
 * The returned validator infers its `Out` type from the schema's
 * `StandardSchemaV1.InferOutput<S>`, so the builder API (`defineSchema`)
 * picks up real per-field types from any Standard-Schema-compatible library.
 */
export function createValidator<
    C = unknown,
    S extends StandardSchemaV1 = StandardSchemaV1,
>(
    input: S | StandardSchemaCreateFn<C, S>,
): Validator<C, StandardSchemaV1.InferOutput<S>> {
    return async (ctx) => {
        const schema = typeof input === 'function' ? input(ctx) : input;
        const result = await schema['~standard'].validate(ctx.value);

        if (!result.issues) {
            return result.value as StandardSchemaV1.InferOutput<S>;
        }

        throw new ValidupError(buildIssuesForStandardSchemaIssues(result.issues));
    };
}
