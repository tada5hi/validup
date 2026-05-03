/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import { defineIssueItem, isObject } from 'validup';
import type { Issue } from 'validup';

/**
 * Convert a Standard Schema path (`(PropertyKey | { key })[]`) into a validup
 * `PropertyKey[]`. PathSegments are unwrapped to their `.key`.
 */
function normalizePath(
    path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment> | undefined,
): PropertyKey[] {
    if (!path || path.length === 0) {
        return [];
    }

    const output: PropertyKey[] = [];
    for (const segment of path) {
        if (isObject(segment) && 'key' in segment) {
            output.push(segment.key as PropertyKey);
        } else {
            output.push(segment as PropertyKey);
        }
    }
    return output;
}

/**
 * Translate Standard Schema issues into validup `IssueItem`s. Standard Schema
 * intentionally only exposes `message` + `path`; vendor-specific fields like
 * `expected`/`received`/`code` are not part of the spec, so the resulting
 * issues carry only the portable subset (`code` defaults to
 * `IssueCode.VALUE_INVALID`).
 */
export function buildIssuesForStandardSchemaIssues(
    issues: ReadonlyArray<StandardSchemaV1.Issue>,
): Issue[] {
    const output: Issue[] = [];
    for (const issue of issues) {
        output.push(defineIssueItem({
            path: normalizePath(issue.path),
            message: issue.message,
        }));
    }
    return output;
}
