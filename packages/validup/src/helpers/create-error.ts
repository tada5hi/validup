/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupError } from '../error';
import { defineIssueItem } from '../issue';

/**
 * Build a `ValidupError` carrying a single `IssueItem` with the supplied
 * code / message / params. Sugar for the common one-issue failure
 * construction used by adapters and hand-rolled validators.
 *
 * The caller throws — keeping the `throw` keyword at the call site
 * makes the failure path obvious in the validator function body:
 *
 * ```ts
 * if (!validator.isEmail(s)) {
 *     throw createValidupError(ctx.value, IssueCode.EMAIL, 'Invalid email');
 * }
 * ```
 *
 * For multi-issue failures (e.g. inside {@link composeAll}), build a
 * `ValidupError` directly with `new ValidupError([defineIssueItem(...), …])`.
 */
export function createValidupError(
    received: unknown,
    code: string,
    message: string,
    params?: Record<string, unknown>,
): ValidupError {
    return new ValidupError([
        defineIssueItem({
            path: [],
            message,
            code,
            params,
            received,
        }),
    ]);
}
