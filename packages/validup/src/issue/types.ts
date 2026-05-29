/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { 
    BareIssueCode, 
    IssueCode, 
    IssueDataByCode, 
    ParameterizedIssueCode, 
} from './constants';

/**
 * Resolve a possibly-`undefined` `code` to its effective vocabulary entry.
 * When a producer (`defineIssueItem`, `createValidupError`) is called
 * without a `code`, the runtime defaults to `IssueCode.VALUE_INVALID`;
 * this helper reflects that at the type level so the conditional-type
 * signatures pick the bare-data branch instead of the raw catch-all.
 *
 * `[C] extends [undefined]` is the standard idiom for testing the whole
 * `C` against `undefined` *without* distributing over union members.
 */
export type ResolveIssueCode<C> = [C] extends [undefined] ?
    typeof IssueCode.VALUE_INVALID :
    C & string;

export interface IssueBase {
    /**
     * Out-of-band provenance about how this issue came to exist — context the
     * consumer cannot reconstruct from `path` + the container's mount config.
     *
     * Library-owned keys (stable, semver-protected):
     *
     * - `optional?: true` — set by the runtime when the originating mount's
     *   `optional` declaration resolves truthy for the current value:
     *
     *   - `optional: true`  → tagged
     *   - `optional: false` → not tagged (matches the runtime's truthy filter)
     *   - `optional: (v) => boolean` → predicate is invoked with the current
     *     value; tagged iff it returns truthy. In practice the run loop only
     *     enters the error path when the predicate has already returned
     *     false (otherwise the validator would have been skipped), so
     *     predicate-optional issues effectively never carry the flag today.
     *   - `optional: undefined` → not tagged
     *
     *   Reflects only the most-local mount, never inherited from a parent:
     *   a leaf inside an optional child container does NOT carry the flag
     *   unless its own mount also evaluated truthy. Set on direct leaf
     *   emissions and on the wrapping `IssueGroup` produced for the mount
     *   itself; never set on issues that bubbled up unchanged through
     *   `prefixIssuePath`.
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
     * available to consumer-side formatters (i18n, custom locales). The
     * concrete shape depends on the discriminating `code` — see the
     * `IssueItem` union below for the per-code contract.
     */
    data?: Record<string, unknown>
}

/**
 * Shared shape for every `IssueItem` branch — the discriminant (`type:
 * 'item'`) plus the vendor-passthrough fields. The `code` and `data`
 * fields are intentionally absent here; each branch in the discriminated
 * union below pins them to the right pair.
 */
interface IssueItemCommon extends IssueBase {
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

/**
 * Typed-data branch — one variant per `ParameterizedIssueCode`. The
 * `data` shape is locked to the documented contract via
 * {@link IssueDataByCode}.
 *
 * Distributed (rather than written as a single `code: ParameterizedIssueCode`
 * member) so that `Extract<IssueItem, { code: 'min_length' }>` and structural
 * narrowing on `issue.code === IssueCode.MIN_LENGTH` resolve to the right
 * concrete variant with `data: { min: number }`, not the joined union.
 */
export type IssueItemTyped = {
    [K in ParameterizedIssueCode]: IssueItemCommon & {
        code: K,
        data: IssueDataByCode[K],
    };
}[ParameterizedIssueCode];

/**
 * Bare-data branch — one variant per `BareIssueCode`. `data` must be
 * absent (or explicitly `undefined`).
 *
 * Distributed for the same reason as {@link IssueItemTyped} — so
 * `Extract<IssueItem, { code: 'email' }>` resolves to the single
 * `code: 'email'` variant.
 */
export type IssueItemBare = {
    [K in BareIssueCode]: IssueItemCommon & {
        code: K,
        data?: undefined,
    };
}[BareIssueCode];

/**
 * Escape-hatch branch — ad-hoc / project-specific codes outside the
 * shipped vocabulary. `code: string & {}` keeps autocomplete on the
 * `IssueCode` literals while permitting strings the typed branches don't
 * cover; `data` is fully open.
 *
 * Note: because `string & {}` accepts any string at the type level,
 * narrowing on `issue.code === IssueCode.MIN_LENGTH` still pulls this
 * branch in alongside the matching `IssueItemTyped` variant. The
 * producer-side `defineIssueItem` / `createValidupError` signatures
 * gatekeep this so emission is always correct; consumers needing a
 * clean narrow should cast `issue.data` after the code check.
 */
export interface IssueItemRaw extends IssueItemCommon {
    code: string & {},
    data?: Record<string, unknown>,
}

/**
 * Discriminated union over `IssueItem`'s three branches:
 *
 * - {@link IssueItemTyped} — known parameterized codes (`MIN_LENGTH`,
 *   `PATTERN`, `STRONG_PASSWORD`, …); `data` is required and typed.
 * - {@link IssueItemBare} — known param-less codes (`EMAIL`, `REQUIRED`,
 *   …); `data` must be absent.
 * - {@link IssueItemRaw} — ad-hoc string codes; `data` is open.
 *
 * The discriminant is `code`. Build issues with `defineIssueItem` (typed
 * overloads enforce the per-branch contract) rather than constructing
 * literals by hand.
 */
export type IssueItem = IssueItemTyped | IssueItemBare | IssueItemRaw;

export interface IssueGroup extends IssueBase {
    /**
     * Code identifying the issue. See `IssueItem.code` for the
     * vocabulary + ad-hoc widening conventions.
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
