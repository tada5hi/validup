/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isError, isValidupError } from '../error';
import { IssueCode, defineIssueItem } from '../issue';
import type { Issue } from '../issue';

/**
 * Options for {@link errorToIssues}. Defaults match what the
 * orchestrating helpers (compose's collect-all catch, composeAnyOf's
 * branch-failure path) want out of the box.
 */
export type ErrorToIssuesOptions = {
    /**
     * Code stamped on the synthetic `IssueItem` when the thrown value
     * is an `Error` or a non-`Error` throw. Defaults to
     * `IssueCode.VALUE_INVALID`. `ValidupError` issues are spread
     * verbatim and DO NOT get this code applied; their own codes are
     * preserved.
     */
    code?: IssueCode | (string & {}),
    /**
     * Path on the synthetic `IssueItem`. Defaults to `[]`.
     * `ValidupError` issues are spread verbatim with their original
     * paths intact — callers that want to prefix or transform spread
     * paths should do so after this fold (the surrounding Container
     * run loop does this in `prefixIssuePath`, for example).
     */
    path?: PropertyKey[],
};

/**
 * The "given an unknown throw, produce `Issue[]`" cascade shared by
 * the validator-orchestrating helpers. The branching is identical
 * at each site — `ValidupError` fans out, `Error` becomes one item,
 * anything else gets a defensive stringify — so it lives here.
 *
 * - `ValidupError` → returns a fresh array containing each of its
 *   `issues` verbatim (callers can map/prefix after).
 * - `Error` → returns one `IssueItem` carrying the message + supplied
 *   code/path.
 * - Anything else (string, plain object, `null`, …) → returns one
 *   defensively-stringified `IssueItem` so the aggregate is never
 *   silently missing a contributing failure.
 *
 * Callers layer their own per-site concerns on top of the returned
 * issues: path prefixing, optional stamping, per-branch index
 * stamping, etc.
 */
export function errorToIssues(
    error: unknown,
    options: ErrorToIssuesOptions = {},
): Issue[] {
    const code = options.code ?? IssueCode.VALUE_INVALID;
    const path = options.path ?? [];

    if (isValidupError(error)) {
        return [...error.issues];
    }

    if (isError(error)) {
        return [defineIssueItem({
            path,
            code,
            message: error.message,
        })];
    }

    return [defineIssueItem({
        path,
        code,
        message: typeof error === 'string' && error.length > 0 ?
            error :
            `Non-Error throw: ${String(error)}`,
    })];
}
