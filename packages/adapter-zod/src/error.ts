/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineIssueItem, hasOwnProperty, isIssueItem } from 'validup';
import type { $ZodRawIssue } from 'zod/v4/core';
import type { ZodError } from 'zod';
import type { Issue, ValidupError } from 'validup';

export type ZodIssue = $ZodRawIssue;

export function buildIssuesForZodError(error: ZodError) {
    const issues : Issue[] = [];

    for (let i = 0; i < error.issues.length; i++) {
        const issue = error.issues[i];

        let expected : unknown;
        if (hasOwnProperty(issue, 'expected')) {
            expected = issue.expected;
        }

        let received : unknown;
        if (hasOwnProperty(issue, 'received')) {
            received = issue.received;
        }

        issues.push(defineIssueItem({
            path: issue.path || [],
            message: issue.message,
            expected,
            received,
        }));
    }

    return issues;
}

/**
 * Build Zod Issues for validup issue.
 *
 * @param issue
 */
export function buildZodIssuesForIssue(issue: Issue) : ZodIssue[] {
    if (isIssueItem(issue)) {
        return [
            {
                code: 'custom',
                message: issue.message,
                path: issue.path,
                input: issue.received,
            },
        ];
    }

    const output : ZodIssue[] = [];
    for (let i = 0; i < issue.issues.length; i++) {
        const child = issue.issues[i];

        output.push(...buildZodIssuesForIssue(child));
    }

    return output;
}

export function buildZodIssuesForError(error: ValidupError) : ZodIssue[] {
    return error.issues
        .map((issue) => buildZodIssuesForIssue(issue))
        .flat();
}
