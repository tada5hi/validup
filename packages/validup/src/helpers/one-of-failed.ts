/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { IssueCode, defineIssueGroup } from '../issue';
import type { Issue, IssueGroup } from '../issue';

/**
 * Options for {@link buildOneOfFailedGroup}.
 */
export type BuildOneOfFailedGroupOptions = {
    /**
     * Path on the wrapping group. Defaults to `[]` — most callers
     * (compose's `composeAnyOf`, the run-loop entry to a oneOf
     * container) emit the group at the boundary they own and let the
     * surrounding context attach a path.
     */
    path?: PropertyKey[],
    /**
     * Override the default English message. The wrapping group
     * carries `code: IssueCode.ONE_OF_FAILED`, so i18n catalogs key
     * off the code rather than the message; the message is only the
     * fallback rendering.
     */
    message?: string,
};

/**
 * Build the `IssueGroup` that wraps an every-branch-failed aggregate
 * — used by `composeAnyOf` (validator-level oneOf) AND
 * `Container.finalizeOutput` (container-level `oneOf` option). Sharing
 * the shape keeps the `IssueCode.ONE_OF_FAILED` contract symmetric so
 * consumers / i18n catalogs only need one format for both modes.
 */
export function buildOneOfFailedGroup(
    branchIssues: Issue[],
    options: BuildOneOfFailedGroupOptions = {},
): IssueGroup {
    return defineIssueGroup({
        code: IssueCode.ONE_OF_FAILED,
        message: options.message ?? 'None of the branches succeeded',
        path: options.path ?? [],
        issues: branchIssues,
    });
}
