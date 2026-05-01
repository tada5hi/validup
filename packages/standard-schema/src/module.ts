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

type StandardSchemaCreateFn<C = unknown> = (
    ctx: ValidatorContext<C>,
) => StandardSchemaV1;

/**
 * Wrap any Standard Schema validator (zod 3.24+, valibot, arktype,
 * effect-schema, …) as a validup `Validator`. The schema's `~standard.validate`
 * method is invoked with the mounted value; on failure, its issues are
 * translated into validup `IssueItem`s.
 *
 * Pass a function instead of a schema to build per-context schemas
 * (e.g. depending on the active group, sibling values, or `ctx.context`).
 */
export function createValidator<C = unknown>(
    input: StandardSchemaV1 | StandardSchemaCreateFn<C>,
): Validator<C> {
    return async (ctx): Promise<unknown> => {
        const schema = typeof input === 'function' ? input(ctx) : input;
        const result = await schema['~standard'].validate(ctx.value);

        if (!result.issues) {
            return result.value;
        }

        throw new ValidupError(buildIssuesForStandardSchemaIssues(result.issues));
    };
}
