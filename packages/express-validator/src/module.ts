/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ContextRunner } from 'express-validator';
import type { Issue, Validator, ValidatorContext } from 'validup';
import { ValidupError } from 'validup';
import { buildIssuesForErrors } from './error';

type ContextRunnerCreateFn<C = unknown> = (
    ctx: ValidatorContext<C>,
) => ContextRunner;

export function createValidator<C = unknown>(
    input: ContextRunnerCreateFn<C> | ContextRunner,
) : Validator<C> {
    return async (ctx): Promise<unknown> => {
        const runner: ContextRunner = typeof input === 'function' ? input(ctx) : input;

        const outcome = await runner.run({ body: ctx.value });

        // Translate every error reported by the chain — including `alternative`
        // and `alternative_grouped` shapes, which the previous implementation
        // filtered out by matching only `type === 'field'` against the first
        // selected field.
        const issues: Issue[] = buildIssuesForErrors(
            outcome.context.errors as Parameters<typeof buildIssuesForErrors>[0],
        );

        if (issues.length > 0) {
            throw new ValidupError(issues);
        }

        // No errors — return the (possibly sanitized) value. Express-validator
        // mutates `FieldInstance.value` in place as sanitizers run, so
        // `field.value` reflects post-sanitizer state. When the chain selects a
        // single field we forward that; otherwise the chain doesn't designate
        // a primary value, so fall back to the original input.
        const fields = outcome.context.getData({ requiredOnly: false });
        if (fields.length === 1) {
            return fields[0].value;
        }
        return ctx.value;
    };
}
