/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidationError } from 'express-validator/lib/base';
import type { Issue } from 'validup';
import { IssueCode, defineIssueGroup, defineIssueItem } from 'validup';

/**
 * Split express-validator's dotted/bracketed path string (`"address.city"`,
 * `"tags[0].name"`) into a flat `PropertyKey[]` so consumers can walk it
 * uniformly with validup's other issue paths. Numeric bracket segments are
 * coerced to `number` to match the convention used by `pathtrace`.
 */
function splitPath(path: string): PropertyKey[] {
    if (!path) {
        return [];
    }

    const segments: PropertyKey[] = [];
    let cursor = 0;
    const len = path.length;

    while (cursor < len) {
        if (path[cursor] === '.') {
            cursor++;
            continue;
        }

        if (path[cursor] === '[') {
            const end = path.indexOf(']', cursor + 1);
            if (end === -1) {
                // Malformed path — give up and treat the remainder verbatim.
                segments.push(path.slice(cursor));
                break;
            }
            const raw = path.slice(cursor + 1, end);
            // Numeric bracket indices become numbers; quoted/string keys stay
            // strings (with the surrounding quotes stripped).
            if (/^\d+$/.test(raw)) {
                segments.push(Number(raw));
            } else {
                segments.push(raw.replace(/^['"]|['"]$/g, ''));
            }
            cursor = end + 1;
            continue;
        }

        let next = cursor;
        while (next < len && path[next] !== '.' && path[next] !== '[') {
            next++;
        }
        segments.push(path.slice(cursor, next));
        cursor = next;
    }

    return segments;
}

function buildIssuesForError(error: ValidationError): Issue[] {
    switch (error.type) {
        case 'field': {
            return [defineIssueItem({
                path: splitPath(error.path),
                received: error.value,
                message: typeof error.msg === 'string' ? error.msg : String(error.msg),
            })];
        }
        case 'alternative': {
            // `oneOf()` chain — every branch failed. Wrap the per-branch field
            // errors in a group so consumers can tell this apart from a flat
            // list of independent field errors.
            return [defineIssueGroup({
                code: IssueCode.ONE_OF_FAILED,
                message: typeof error.msg === 'string' ? error.msg : String(error.msg),
                path: [],
                issues: error.nestedErrors.flatMap((nested) => buildIssuesForError(nested)),
            })];
        }
        case 'alternative_grouped': {
            // `oneOf({ errorType: 'grouped' })` — each branch's errors are
            // kept under a sub-group so consumers can recover the per-branch
            // structure (useful for surfacing "branch N failed because …").
            return [defineIssueGroup({
                code: IssueCode.ONE_OF_FAILED,
                message: typeof error.msg === 'string' ? error.msg : String(error.msg),
                path: [],
                issues: error.nestedErrors.map((group, index) => defineIssueGroup({
                    message: `Alternative ${index + 1} failed`,
                    path: [],
                    params: { alternative: index },
                    issues: group.flatMap((nested) => buildIssuesForError(nested)),
                })),
            })];
        }
        default: {
            // `unknown_fields` — no per-field path; surface as a root-level
            // item carrying the message so it isn't silently swallowed.
            return [defineIssueItem({
                path: [],
                message: typeof error.msg === 'string' ? error.msg : String(error.msg),
            })];
        }
    }
}

export function buildIssuesForErrors(errors: readonly ValidationError[]): Issue[] {
    const issues: Issue[] = [];
    for (const error of errors) {
        issues.push(...buildIssuesForError(error));
    }
    return issues;
}
