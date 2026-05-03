/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IssueCode } from './constants';

export interface IssueBase {

    /**
     * Context in which the issue occurred.
     */
    meta?: Record<string, unknown>,

    /**
     * Issue path.
     */
    path: PropertyKey[],

    /**
     * Default-rendered message (eager, English). Use `formatIssue` with a
     * `code → template` map for localized re-rendering at the consumer side.
     */
    message: string,

    /**
     * Structured parameters used by the default `message` rendering and
     * available to consumer-side formatters (i18n, custom locales). For
     * built-in issues created by the runtime, `params` is populated where
     * the message references a non-trivial value (e.g. attribute name).
     */
    params?: Record<string, unknown>
}

export interface IssueItem extends IssueBase {
    /**
     * Code identifying the issue. Known codes come from `IssueCodeRegistry`
     * (extensible via declaration merging); the `string` widening leaves the
     * door open for ad-hoc codes that don't need a registry entry.
     */
    code: IssueCode | (string & {}),

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
     * Code identifying the issue. See `IssueItem.code` for the registry
     * extension mechanism.
     */
    code?: IssueCode | (string & {}),

    /**
     * Issue Type
     */
    type: 'group',

    /**
     * Child issues
     */
    issues: Issue[]
}

export type Issue = IssueGroup | IssueItem;
