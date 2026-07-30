/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Issue,
    IssueGroup,
    IssueItem,
} from 'validup';
import { flattenIssueItems, isIssueGroup } from 'validup';

/**
 * The framework-free projection layer behind `useValidup`.
 *
 * Everything here is `(data) => data`: given the raw `Issue[]` a run
 * produced, the set of dirty paths, and a field path, these functions answer
 * "what should this field / this form display right now?". No `ref`, no
 * `computed`, no `inject` — the composable owns the reactive plumbing and
 * calls into this module from inside its `computed`s, which is what keeps
 * dependency tracking intact.
 *
 * Not re-exported from the package barrel (`src/helpers/index.ts`) — this is
 * internal wiring, same treatment as `helpers/collector.ts`. Specs reach it
 * via its direct module path. Promote to a public export only when an
 * external consumer surfaces a concrete need.
 *
 * ## Path canonicalization
 *
 * One invariant holds the whole module together: a path is canonically a
 * **pure-dotted** string. `pathKey` renders an `Issue.path` (which the core
 * stamps as a segmented array — `'tags[0]'` becomes `['tags', 0]`) into that
 * form, and `pathFromKey(key).join('.')` renders a user-supplied field key
 * into the same form. Every match in this module — exact, ancestor-prefix,
 * dirty-prefix — is a string comparison between two of those.
 *
 * This is why the local codec is NOT replaced by `pathtrace`'s
 * `arrayToPath` / `pathToArray` / `getPathValue` / `setPathValue`, even
 * though the core already depends on them:
 *
 * - `arrayToPath(['tags', 0])` is `'tags[0]'`, not `'tags.0'`, so
 *   `'tags[0].name'.startsWith('tags.')` is false and a parent field would
 *   silently stop aggregating its array children's issues.
 * - `setPathValue` decides array-vs-object auto-creation from the *current*
 *   key rather than the *next* one, so `a[0].b` materializes as
 *   `{ a: { '0': [] } }` and drops the value; it also refuses to replace a
 *   pre-existing `null` intermediate, silently dropping that write too.
 * - `pathToArray` keeps non-numeric brackets verbatim (`'meta[locale]'` →
 *   `['meta', '[locale]']`), which would break `fields.at('meta[locale]')`.
 *
 * They are near-misses, not equivalents. Keeping the codec local also keeps
 * `@validup/vue` free of a direct `pathtrace` dependency.
 */

// ---- path codec ------------------------------------------------------------

/**
 * Render an `Issue.path` into the canonical dotted form.
 *
 * Numeric segments stay bare (`['tags', 0]` → `'tags.0'`) so the result is
 * directly comparable with `pathFromKey(key).join('.')`.
 */
export function pathKey(path: PropertyKey[]): string {
    return path.map((p) => String(p)).join('.');
}

/**
 * Parse a field key into path segments.
 *
 * Accepts dotted (`a.b.c`), bracketed (`a[0].b`), or mixed (`a.b[0].c`).
 *
 * Caveat: top-level keys that *contain a dot* (e.g. `state['user.email']`
 * as a single literal key) are not addressable via this composable —
 * they collide with the dotted path syntax. This is an acknowledged
 * trade-off: vuelidate's path syntax has the same limitation, and form
 * state with literal-dot keys is vanishingly rare in practice.
 */
export function pathFromKey(key: string): string[] {
    return key
        .replace(/\[(\w+)\]/g, '.$1')
        .split('.')
        .filter((s) => s.length > 0);
}

/**
 * Read `segments` off `obj`, short-circuiting to `undefined` on any
 * nullish intermediate. An empty segment list returns `obj` itself.
 */
export function readNested(obj: any, segments: string[]): unknown {
    let cur: any = obj;
    for (const seg of segments) {
        if (cur == null) {
            return undefined;
        }
        cur = cur[seg];
    }
    return cur;
}

/**
 * Write `value` at `segments` on `obj`, materializing missing (or
 * non-object) intermediates along the way.
 *
 * An intermediate becomes an array when the *next* segment is numeric
 * (`items.0.name` → `{ items: [{ name: … }] }`) and a plain object
 * otherwise — lodash `_.set` semantics, so `fields.at('items[0].name')`
 * produces the array a form template expects to `v-for` over.
 */
export function writeNested(obj: any, segments: string[], value: unknown): void {
    if (segments.length === 0) {
        return;
    }
    let cur: any = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (cur[seg] == null || typeof cur[seg] !== 'object') {
            cur[seg] = /^\d+$/.test(segments[i + 1] as string) ? [] : {};
        }
        cur = cur[seg];
    }
    cur[segments[segments.length - 1] as string] = value;
}

// ---- prefix matching -------------------------------------------------------

/**
 * Does `itemPath` sit at, or below, `target`?
 *
 * `'address'` matches `'address'` (exact) and `'address.city'` (descendant),
 * but not `'addressLine'` — the `.` separator is part of the prefix test.
 */
export function isUnderPath(itemPath: string, target: string): boolean {
    return itemPath === target || itemPath.startsWith(`${target}.`);
}

/**
 * Is `key` dirty, either directly or through an ancestor?
 *
 * Touching `address` marks `address.city` dirty too — that is what makes a
 * nested error surface after the user engages with the parent field.
 */
export function isPrefixDirty(dirtyPaths: ReadonlySet<string>, key: string): boolean {
    if (dirtyPaths.has(key)) {
        return true;
    }
    const segments = key.split('.');
    for (let n = 1; n < segments.length; n++) {
        if (dirtyPaths.has(segments.slice(0, n).join('.'))) {
            return true;
        }
    }
    return false;
}

// ---- visibility ------------------------------------------------------------

/**
 * "Should this issue surface as a visible `$errors` entry right now?"
 *
 * Rule: items from required mounts (no `meta.optional`) surface
 * unconditionally — they communicate "this field has unresolved work"
 * the moment validation has run, so a form can render the issue (and the
 * matching `getSeverity` → `'warning'`) on initial load without needing
 * the user to touch every field first. Items from optional mounts stay
 * hidden until the user engages with the field (`isPrefixDirty`), since
 * the schema permits leaving the field blank and we shouldn't nag.
 *
 * Shared between per-field `FieldState.$errors` (via `visibleItems`) and
 * the form-level `Composable.$errors` (via `visibleFormItems`) so both
 * views apply the same rule.
 */
export function isIssueItemVisible(item: IssueItem, dirty: boolean): boolean {
    return dirty || !item.meta?.optional;
}

// ---- per-path issue selection ----------------------------------------------

/**
 * Flattened leaf items belonging to `path` — exact match or descendant.
 * The empty path means "the whole form", so nothing is filtered out.
 */
export function flatItemsAtPath(issues: Issue[], path: string): IssueItem[] {
    const flat = flattenIssueItems(issues);
    if (path === '') {
        return flat;
    }
    return flat.filter((i) => isUnderPath(pathKey(i.path), path));
}

/**
 * Per-field `$errors`: the visible slice of `items` for a field whose
 * dirty state is `dirty`.
 */
export function visibleItems(items: IssueItem[], dirty: boolean): IssueItem[] {
    return items.filter((i) => isIssueItemVisible(i, dirty));
}

/**
 * The raw `Issue[]` tree at `path` — groups preserved rather than
 * flattened.
 *
 * Recurses through `IssueGroup` children: a root `oneOf` group (path `[]`)
 * wraps leaves at `name`/`email`, and `fields.name.$issues` must surface
 * those leaves even though the wrapping group itself doesn't sit at the
 * requested path. A group that *does* sit at the path is returned whole.
 */
export function rawIssuesAtPath(issues: Issue[], path: string): Issue[] {
    if (path === '') {
        return issues;
    }
    const output: Issue[] = [];
    for (const issue of issues) {
        const matches = isUnderPath(pathKey(issue.path), path);
        if (isIssueGroup(issue)) {
            if (matches) {
                output.push(issue);
                continue;
            }
            const inner = rawIssuesAtPath(issue.issues, path);
            if (inner.length > 0) {
                output.push({ ...issue, issues: inner });
            }
            continue;
        }
        if (matches) {
            output.push(issue);
        }
    }
    return output;
}

// ---- form-level issue selection --------------------------------------------

/**
 * Form-level `$errors` — same visibility rule as the per-field view, with
 * each item gated on *its own* path's dirty state. Path-less issues are
 * excluded here; they surface via `crossCuttingItems` instead.
 */
export function visibleFormItems(issues: Issue[], dirtyPaths: ReadonlySet<string>): IssueItem[] {
    return flattenIssueItems(issues)
        .filter((i) => i.path.length > 0 &&
            isIssueItemVisible(i, isPrefixDirty(dirtyPaths, pathKey(i.path))));
}

/**
 * Path-less issues (cross-cutting failures like rate limit, CSRF, or
 * schema-level container errors) — always visible, no dirty gate.
 */
export function crossCuttingItems(issues: Issue[]): IssueItem[] {
    return flattenIssueItems(issues).filter((i) => i.path.length === 0);
}

/**
 * Top-level `IssueGroup`s that should surface right now. Empty-path groups
 * appear once anything on the form is dirty; pathed groups gate on the
 * usual ancestor-prefix dirty rule.
 *
 * Top-level only — `oneOf` containers wrap each failing branch in its own
 * sub-group to preserve per-branch identity, and those sub-groups are not
 * themselves `$groupErrors` targets.
 */
export function visibleGroups(issues: Issue[], dirtyPaths: ReadonlySet<string>): IssueGroup[] {
    return issues
        .filter(isIssueGroup)
        .filter((g) => {
            if (g.path.length === 0) {
                return dirtyPaths.size > 0;
            }
            return isPrefixDirty(dirtyPaths, pathKey(g.path));
        });
}

// ---- external issues -------------------------------------------------------

/**
 * Drop every external issue sitting at or below `target`.
 *
 * Groups are handled structurally: a group whose own path is under the
 * target is dropped wholesale, otherwise its children are pruned and the
 * group is rebuilt when only some of them matched (and dropped entirely
 * when none survive).
 */
export function pruneExternalAtPath(issues: Issue[], target: string): Issue[] {
    const output: Issue[] = [];
    for (const issue of issues) {
        const ip = pathKey(issue.path);
        if (isIssueGroup(issue)) {
            if (isUnderPath(ip, target)) {
                // Whole group sits under the cleared path — drop it.
                continue;
            }
            // The group itself is outside but its leaves may still match
            // (e.g. a top-level `oneOf` group contains a leaf at `name`).
            const inner = pruneExternalAtPath(issue.issues, target);
            if (inner.length === issue.issues.length) {
                output.push(issue);
            } else if (inner.length > 0) {
                output.push({ ...issue, issues: inner });
            }
            // empty group → drop entirely
            continue;
        }
        if (!isUnderPath(ip, target)) {
            output.push(issue);
        }
    }
    return output;
}

/**
 * Stamp `meta.external: true` on an issue and — for groups — every issue
 * beneath it, so themes can tell server-supplied issues from
 * validator-supplied ones.
 */
export function tagExternal(issue: Issue): Issue {
    const meta = { ...(issue.meta ?? {}), external: true };
    if (isIssueGroup(issue)) {
        return {
            ...issue,
            meta,
            issues: issue.issues.map(tagExternal),
        };
    }
    return { ...issue, meta };
}
