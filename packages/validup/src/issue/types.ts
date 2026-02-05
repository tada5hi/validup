/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IssueCode, IssueSeverity } from './constants';

export interface Issue {
    /**
     * Code identifying the issue
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    code: `${IssueCode}` | (string & {}),

    /**
     * Context in which the issue occurred.
     */
    meta? :Record<string, any>,

    /**
     * Issue severity level (warning, info, error)
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    severity: `${IssueSeverity}` | (string & {}),

    /**
     * Received input value.
     */
    received?: unknown,

    /**
     * Expected input value.
     */
    expected?: unknown

    /**
     * Issue path.
     */
    path: PropertyKey[],

    /**
     * Issue message.
     */
    message: string,

    /**
     * Sub issues
     */
    issues: Issue[],
}

export type IssueInput = Omit<Issue, 'severity' | 'code' | 'issues'> &
Partial<Pick<Issue, 'severity' | 'code' | 'issues'>>;
