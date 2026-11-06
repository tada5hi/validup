/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { IssueCode, defineIssueGroup } from '@ebec/core';
import type { Issue, IssueGroup } from '@ebec/core';

import type { BuildOneOfFailedGroupOptions } from './types';

/**
 * Options for {@link buildOneOfFailedGroup}.
 */

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
export type { BuildOneOfFailedGroupOptions };
