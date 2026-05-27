/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IssueCode } from './constants';

export interface IssueBase {
    /**
     * Out-of-band provenance about how this issue came to exist — context the
     * consumer cannot reconstruct from `path` + the container's mount config.
     *
     * Library-owned keys (stable, semver-protected):
     *
     * - `optional?: true` — set by the runtime when the originating mount
     *   declared `optional` config (boolean or predicate). Reflects only the
     *   most-local mount, never inherited from a parent: a leaf inside an
     *   optional child container does NOT carry the flag unless its own mount
     *   was also declared optional. Set on direct leaf emissions and on the
     *   wrapping `IssueGroup` produced for the mount itself; never set on
     *   issues that bubbled up unchanged through `prefixIssuePath`.
     * - `external?: true` — set by frameworks that inject server-side issues
     *   (e.g. `@validup/vue`'s `setExternalIssues`). Distinguishes
     *   server-supplied from validator-supplied so consumers can render the
     *   distinction.
     *
     * Apps and third-party validators may add their own keys (e.g.
     * `app.componentId`) — the open-shape `Record<string, unknown>` is
     * intentional. New library-owned keys must pass the bar above:
     * provenance, not derivable from path + container config. Presentation
     * tokens (e.g. `severity`) do not qualify and live in consumer code.
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
