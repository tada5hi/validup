/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export interface IssueBase {
    /**
     * Code identifying the issue
     */
    code?: string,

    /**
     * Context in which the issue occurred.
     */
    meta?: Record<string, unknown>,

    /**
     * Issue path.
     */
    path: PropertyKey[],

    /**
     * Issue message.
     */
    message: string
}

export interface IssueItem extends IssueBase {
    /**
     * Issue Type
     */
    type: 'item',

    /**
     * Received input value.
     */
    received?: unknown,

    /**
     * Expected input value.
     */
    expected?: unknown,
}

export interface IssueGroup extends IssueBase {
    /**
     * Issue Type
     */
    type: 'group',

    issues: Issue[]
}

export type Issue = IssueGroup | IssueItem;
