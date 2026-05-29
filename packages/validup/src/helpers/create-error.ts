/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupError } from '../error';
import { defineIssueItem } from '../issue';
import type { 
    BareIssueCode, 
    IssueCode, 
    IssueDataByCode, 
    ParameterizedIssueCode, 
    ResolveIssueCode, 
} from '../issue';

/**
 * Trailing-args shape selected by the resolved `code`:
 *
 * - Parameterized code → `data` is required and typed.
 * - Bare code → no trailing arg accepted.
 * - Ad-hoc string code → `data?: Record<string, unknown>` optional.
 */
type CreateValidupErrorTail<C> = ResolveIssueCode<C> extends ParameterizedIssueCode ?
    [data: IssueDataByCode[ResolveIssueCode<C> & ParameterizedIssueCode]] :
    ResolveIssueCode<C> extends BareIssueCode ?
        [] :
        [data?: Record<string, unknown>];

/**
 * Build a `ValidupError` carrying a single `IssueItem` with the supplied
 * code / message / data. Sugar for the common one-issue failure
 * construction used by adapters and hand-rolled validators.
 *
 * The caller throws — keeping the `throw` keyword at the call site
 * makes the failure path obvious in the validator function body:
 *
 * ```ts
 * if (!validator.isEmail(s)) {
 *     throw createValidupError(ctx.value, IssueCode.EMAIL, 'Invalid email');
 * }
 *
 * if (!isInRange(s)) {
 *     throw createValidupError(ctx.value, IssueCode.MIN_VALUE, msg, { min: 18 });
 * }
 * ```
 *
 * The `code` you pass selects the `data` requirement at compile time:
 * parameterized codes (`MIN_LENGTH`, `STRONG_PASSWORD`, …) require their
 * typed payload; bare codes (`EMAIL`, `REQUIRED`, …) take no data; any
 * other string falls through to an open `Record<string, unknown>` data
 * argument.
 *
 * For multi-issue failures (e.g. inside {@link compose} with `{ bail: false }`),
 * build a `ValidupError` directly with
 * `new ValidupError([defineIssueItem(...), …])`.
 */
export function createValidupError<C extends string = typeof IssueCode.VALUE_INVALID>(
    received: unknown,
    code: C,
    message: string,
    ...rest: CreateValidupErrorTail<C>
): ValidupError {
    const data = rest[0] as Record<string, unknown> | undefined;
    return new ValidupError([
        defineIssueItem({
            path: [],
            message,
            code,
            data,
            received,
        } as Parameters<typeof defineIssueItem>[0]),
    ]);
}
