/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isIssueGroup, isIssueItem } from './check';
import type { Issue, IssueGroup, IssueItem } from './types';

export function flattenIssueItems(issues: Issue[]): IssueItem[] {
    const output: IssueItem[] = [];
    for (const issue of issues) {
        if (isIssueItem(issue)) {
            output.push(issue);
        } else {
            output.push(...flattenIssueItems(issue.issues));
        }
    }
    return output;
}

export function flattenIssueGroups(issues: Issue[]): IssueGroup[] {
    const output: IssueGroup[] = [];
    for (const issue of issues) {
        if (isIssueGroup(issue)) {
            output.push(issue);
            output.push(...flattenIssueGroups(issue.issues));
        }
    }
    return output;
}
