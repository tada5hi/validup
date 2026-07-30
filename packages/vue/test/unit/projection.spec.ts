/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// @vitest-environment node
//
// The projection layer takes plain data and returns plain data, so this
// suite needs neither `happy-dom` nor `@vue/test-utils` — the package-level
// `environment: 'happy-dom'` is overridden per file to prove it. Nothing
// below imports `vue`.

import { describe, expect, it } from 'vitest';
import { IssueCode, defineIssueGroup, defineIssueItem } from 'validup';
import type { Issue, IssueItem } from 'validup';
import {
    crossCuttingItems,
    flatItemsAtPath,
    isIssueItemVisible,
    isPrefixDirty,
    isUnderPath,
    pathFromKey,
    pathKey,
    pruneExternalAtPath,
    rawIssuesAtPath,
    readNested,
    tagExternal,
    visibleFormItems,
    visibleGroups,
    visibleItems,
    writeNested,
} from '../../src/helpers/projection';

/**
 * Minimal issue fixtures. `useValidup` never inspects anything beyond
 * `path` / `meta` / (for groups) `issues`, so each case states only what
 * it cares about instead of routing a real `Container` run through a
 * mounted component.
 */
function item(path: PropertyKey[], meta?: Record<string, unknown>): IssueItem {
    return defineIssueItem({
        path,
        message: `issue at ${path.join('.') || '<root>'}`,
        ...(meta ? { meta } : {}),
    });
}

function optionalItem(path: PropertyKey[]): IssueItem {
    return item(path, { optional: true });
}

function group(path: PropertyKey[], issues: Issue[]): Issue {
    return defineIssueGroup({
        path,
        code: IssueCode.ONE_OF_FAILED,
        message: `group at ${path.join('.') || '<root>'}`,
        issues,
    });
}

describe('projection module', () => {
    it('runs without a DOM', () => {
        // Pins the boundary: if this suite ever needs `document`, something
        // framework-bound leaked out of `useValidup` into the projection layer.
        expect(typeof globalThis.document).toBe('undefined');
    });
});

describe('pathKey', () => {
    it('renders a segmented path into the canonical dotted form', () => {
        expect(pathKey(['address', 'city'])).toBe('address.city');
    });

    it('keeps numeric segments bare so they match a parsed field key', () => {
        // The core stamps `tags[0]` as `['tags', 0]`. Bracket notation here
        // would break `'tags.0'.startsWith('tags.')`-style prefix matching.
        expect(pathKey(['tags', 0])).toBe('tags.0');
        expect(pathKey(['tags', 0])).toBe(pathFromKey('tags[0]').join('.'));
    });

    it('renders the empty path as the empty string', () => {
        expect(pathKey([])).toBe('');
    });
});

describe('pathFromKey', () => {
    it('parses a dotted key', () => {
        expect(pathFromKey('user.address.city')).toEqual(['user', 'address', 'city']);
    });

    it('parses bracketed array indices', () => {
        expect(pathFromKey('items[0]')).toEqual(['items', '0']);
        expect(pathFromKey('items[0][1]')).toEqual(['items', '0', '1']);
    });

    it('parses mixed dotted and bracketed keys', () => {
        expect(pathFromKey('a.b[0].c')).toEqual(['a', 'b', '0', 'c']);
    });

    it('parses non-numeric brackets as plain segments', () => {
        expect(pathFromKey('meta[locale]')).toEqual(['meta', 'locale']);
    });

    it('drops empty segments', () => {
        expect(pathFromKey('')).toEqual([]);
        expect(pathFromKey('.a..b.')).toEqual(['a', 'b']);
    });

    it('cannot address a literal-dot key — the documented caveat', () => {
        // `state['user.email']` as a SINGLE literal key is unreachable:
        // the dotted syntax wins and splits it into two segments. This is
        // the acknowledged trade-off recorded on `pathFromKey`; asserted
        // here so a future "fix" is a deliberate behaviour change rather
        // than an accident.
        expect(pathFromKey('user.email')).toEqual(['user', 'email']);
        expect(readNested({ 'user.email': 'a@b.c' }, pathFromKey('user.email'))).toBeUndefined();
        expect(readNested({ 'user.email': 'a@b.c' }, ['user.email'])).toBe('a@b.c');
    });
});

describe('readNested', () => {
    it('reads a nested value', () => {
        expect(readNested({ a: { b: { c: 1 } } }, ['a', 'b', 'c'])).toBe(1);
    });

    it('reads an array element by string segment', () => {
        expect(readNested({ items: ['x', 'y'] }, ['items', '1'])).toBe('y');
    });

    it('short-circuits to undefined on a nullish intermediate', () => {
        expect(readNested({ a: null }, ['a', 'b'])).toBeUndefined();
        expect(readNested(undefined, ['a'])).toBeUndefined();
    });

    it('returns the object itself for an empty segment list', () => {
        const state = { a: 1 };
        expect(readNested(state, [])).toBe(state);
    });

    it('returns undefined rather than leaking a prototype object', () => {
        // Symmetric with writeNested's guard: reading `__proto__` would hand
        // Object.prototype straight to a `$model.value` binding.
        expect(readNested({}, ['__proto__'])).toBeUndefined();
        expect(readNested({}, ['constructor', 'prototype'])).toBeUndefined();
    });
});

describe('writeNested', () => {
    it('writes a top-level value', () => {
        const state: Record<string, unknown> = {};
        writeNested(state, ['name'], 'Peter');
        expect(state).toEqual({ name: 'Peter' });
    });

    it('creates missing object intermediates', () => {
        const state: Record<string, unknown> = {};
        writeNested(state, ['address', 'city'], 'Berlin');
        expect(state).toEqual({ address: { city: 'Berlin' } });
    });

    it('creates an ARRAY when the next segment is numeric', () => {
        const state: Record<string, unknown> = {};
        writeNested(state, ['items', '0', 'name'], 'x');
        expect(Array.isArray(state.items)).toBe(true);
        expect(state).toEqual({ items: [{ name: 'x' }] });
    });

    it('creates an array even when the leaf itself is the index', () => {
        const state: Record<string, unknown> = {};
        writeNested(state, ['tags', '1'], 'b');
        expect(Array.isArray(state.tags)).toBe(true);
        expect((state.tags as unknown[])[1]).toBe('b');
    });

    it('replaces a pre-existing non-object intermediate', () => {
        // Form state initialized as `{ address: null }` is common; the
        // write must still land instead of being silently dropped.
        const state: Record<string, unknown> = { address: null };
        writeNested(state, ['address', 'city'], 'Berlin');
        expect(state).toEqual({ address: { city: 'Berlin' } });
    });

    it('keeps existing sibling keys on an intermediate', () => {
        const state: Record<string, unknown> = { address: { zip: '10115' } };
        writeNested(state, ['address', 'city'], 'Berlin');
        expect(state).toEqual({ address: { zip: '10115', city: 'Berlin' } });
    });

    it('is a no-op for an empty segment list', () => {
        const state: Record<string, unknown> = { a: 1 };
        writeNested(state, [], 'ignored');
        expect(state).toEqual({ a: 1 });
    });

    it('refuses to write through __proto__', () => {
        // Prototype pollution. Before the unsafe-key guard this assigned to
        // Object.prototype and left `state` empty, so any field key derived
        // from user input, a route param or a server response was a vector:
        // `fields.at('__proto__.polluted').$model.value = x`.
        const state: Record<string, unknown> = {};
        writeNested(state, pathFromKey('__proto__.polluted'), 'PWN');
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(state).toEqual({});
    });

    it('refuses to write through constructor or prototype', () => {
        const state: Record<string, unknown> = {};
        writeNested(state, ['constructor', 'prototype', 'owned'], 'PWN');
        writeNested(state, ['prototype', 'owned'], 'PWN');
        expect(({} as Record<string, unknown>).owned).toBeUndefined();
        expect(state).toEqual({});
    });

    it('abandons the whole write when an unsafe key appears mid-path', () => {
        // The guard rejects the path up front rather than truncating it, so
        // no partial intermediates are materialized.
        const state: Record<string, unknown> = {};
        writeNested(state, ['safe', '__proto__', 'x'], 'PWN');
        expect(state).toEqual({});
    });

    it('still writes keys that merely resemble unsafe ones', () => {
        const state: Record<string, unknown> = {};
        writeNested(state, ['__proto__x'], 'ok');
        writeNested(state, ['constructors'], 'ok');
        expect(state).toEqual({ __proto__x: 'ok', constructors: 'ok' });
    });
});

describe('isUnderPath', () => {
    it('matches an exact path', () => {
        expect(isUnderPath('address', 'address')).toBe(true);
    });

    it('matches a descendant path', () => {
        expect(isUnderPath('address.city', 'address')).toBe(true);
    });

    it('does not match a sibling sharing a string prefix', () => {
        expect(isUnderPath('addressLine', 'address')).toBe(false);
    });

    it('does not match an ancestor', () => {
        expect(isUnderPath('address', 'address.city')).toBe(false);
    });
});

describe('isPrefixDirty', () => {
    it('reports a directly dirty path', () => {
        expect(isPrefixDirty(new Set(['address']), 'address')).toBe(true);
    });

    it('reports a path whose ANCESTOR is dirty', () => {
        // Touching `address` must surface the error on `address.city`.
        expect(isPrefixDirty(new Set(['address']), 'address.city')).toBe(true);
        expect(isPrefixDirty(new Set(['a']), 'a.b.c')).toBe(true);
        expect(isPrefixDirty(new Set(['a.b']), 'a.b.c')).toBe(true);
    });

    it('does NOT report a path whose DESCENDANT is dirty', () => {
        expect(isPrefixDirty(new Set(['address.city']), 'address')).toBe(false);
    });

    it('does not match a sibling sharing a string prefix', () => {
        expect(isPrefixDirty(new Set(['address']), 'addressLine')).toBe(false);
    });

    it('reports false for an empty dirty set', () => {
        expect(isPrefixDirty(new Set(), 'a.b')).toBe(false);
    });
});

describe('isIssueItemVisible', () => {
    it('surfaces a required-mount item while pristine', () => {
        expect(isIssueItemVisible(item(['email']), false)).toBe(true);
    });

    it('surfaces a required-mount item once dirty', () => {
        expect(isIssueItemVisible(item(['email']), true)).toBe(true);
    });

    it('hides an optional-mount item while pristine', () => {
        expect(isIssueItemVisible(optionalItem(['bio']), false)).toBe(false);
    });

    it('surfaces an optional-mount item once dirty', () => {
        expect(isIssueItemVisible(optionalItem(['bio']), true)).toBe(true);
    });
});

describe('flatItemsAtPath', () => {
    const issues: Issue[] = [
        item(['name']),
        item(['address', 'city']),
        item(['addressLine']),
        item([]),
    ];

    it('returns everything for the empty path', () => {
        expect(flatItemsAtPath(issues, '')).toHaveLength(4);
    });

    it('matches an exact path', () => {
        expect(flatItemsAtPath(issues, 'name').map((i) => pathKey(i.path))).toEqual(['name']);
    });

    it('matches descendants but not string-prefix siblings', () => {
        expect(flatItemsAtPath(issues, 'address').map((i) => pathKey(i.path)))
            .toEqual(['address.city']);
    });

    it('flattens leaves out of nested groups', () => {
        const nested: Issue[] = [group([], [item(['name']), item(['email'])])];
        expect(flatItemsAtPath(nested, 'name').map((i) => pathKey(i.path))).toEqual(['name']);
    });

    it('matches array-element paths stamped as numeric segments', () => {
        const nested: Issue[] = [item(['tags', 0, 'label'])];
        expect(flatItemsAtPath(nested, 'tags.0')).toHaveLength(1);
        expect(flatItemsAtPath(nested, 'tags')).toHaveLength(1);
    });
});

describe('visibleItems', () => {
    it('applies the shared visibility rule to a field slice', () => {
        const items = [item(['bio']), optionalItem(['bio'])];
        expect(visibleItems(items, false)).toHaveLength(1);
        expect(visibleItems(items, true)).toHaveLength(2);
    });
});

describe('rawIssuesAtPath', () => {
    it('returns the input untouched for the empty path', () => {
        const issues: Issue[] = [item(['name'])];
        expect(rawIssuesAtPath(issues, '')).toBe(issues);
    });

    it('returns a group whole when the group itself sits at the path', () => {
        // The child deliberately does NOT match the target. If the whole-group
        // early-push were removed, the rebuild path would filter `name` out,
        // leave `inner` empty and drop the group entirely — so this fixture
        // distinguishes the branch. A child that also matched would make the
        // rebuild produce a structurally identical group and pass either way.
        const g = group(['address'], [item(['name'])]);
        expect(rawIssuesAtPath([g], 'address')).toEqual([g]);
    });

    it('recurses into a group and rebuilds it with the matching leaves', () => {
        // A root `oneOf` group (path `[]`) wraps leaves at `name` / `email`;
        // `fields.name.$issues` must still surface the `name` leaf.
        const g = group([], [item(['name']), item(['email'])]);
        const output = rawIssuesAtPath([g], 'name');
        expect(output).toHaveLength(1);
        const [rebuilt] = output as [Extract<Issue, { type: 'group' }>];
        expect(rebuilt.type).toBe('group');
        expect(rebuilt).not.toBe(g);
        expect(rebuilt.issues.map((i) => pathKey(i.path))).toEqual(['name']);
    });

    it('recurses through nested group levels', () => {
        const inner = group([], [item(['name'])]);
        const outer = group([], [inner, item(['email'])]);
        const output = rawIssuesAtPath([outer], 'name') as [Extract<Issue, { type: 'group' }>];
        expect(output).toHaveLength(1);
        const [nested] = output[0].issues as [Extract<Issue, { type: 'group' }>];
        expect(nested.issues.map((i) => pathKey(i.path))).toEqual(['name']);
    });

    it('drops a group whose children do not match', () => {
        const g = group([], [item(['email'])]);
        expect(rawIssuesAtPath([g], 'name')).toEqual([]);
    });

    it('keeps leaves at or below the path and drops the rest', () => {
        const issues: Issue[] = [item(['address']), item(['address', 'city']), item(['name'])];
        expect(rawIssuesAtPath(issues, 'address').map((i) => pathKey(i.path)))
            .toEqual(['address', 'address.city']);
    });
});

describe('visibleFormItems', () => {
    it('gates each item on ITS OWN path being dirty', () => {
        const issues: Issue[] = [optionalItem(['bio']), optionalItem(['nickname'])];
        expect(visibleFormItems(issues, new Set(['bio'])).map((i) => pathKey(i.path)))
            .toEqual(['bio']);
    });

    it('surfaces required-mount items regardless of dirty state', () => {
        const issues: Issue[] = [item(['name'])];
        expect(visibleFormItems(issues, new Set())).toHaveLength(1);
    });

    it('honours ancestor-prefix dirtiness', () => {
        const issues: Issue[] = [optionalItem(['address', 'city'])];
        expect(visibleFormItems(issues, new Set())).toHaveLength(0);
        expect(visibleFormItems(issues, new Set(['address']))).toHaveLength(1);
    });

    it('excludes path-less issues — those belong to $crossCuttingErrors', () => {
        const issues: Issue[] = [item([]), item(['name'])];
        expect(visibleFormItems(issues, new Set()).map((i) => pathKey(i.path))).toEqual(['name']);
    });

    it('applies the same rule as the per-field view', () => {
        // Regression guard for the "one visibility rule" invariant: the
        // form-level and field-level projections must agree on a given item.
        const optional = optionalItem(['bio']);
        expect(visibleFormItems([optional], new Set())).toEqual(visibleItems([optional], false));
        expect(visibleFormItems([optional], new Set(['bio'])))
            .toEqual(visibleItems([optional], true));
    });
});

describe('crossCuttingItems', () => {
    it('keeps only path-less leaves', () => {
        const issues: Issue[] = [item([]), item(['name'])];
        expect(crossCuttingItems(issues).map((i) => i.path)).toEqual([[]]);
    });

    it('flattens path-less leaves out of groups', () => {
        const issues: Issue[] = [group([], [item([]), item(['name'])])];
        expect(crossCuttingItems(issues)).toHaveLength(1);
    });
});

describe('visibleGroups', () => {
    it('ignores leaf items', () => {
        expect(visibleGroups([item(['name'])], new Set(['name']))).toEqual([]);
    });

    it('surfaces an empty-path group once anything is dirty', () => {
        const g = group([], [item(['name'])]);
        expect(visibleGroups([g], new Set())).toEqual([]);
        expect(visibleGroups([g], new Set(['name']))).toEqual([g]);
    });

    it('gates a pathed group on prefix dirtiness', () => {
        const g = group(['address'], [item(['address', 'city'])]);
        expect(visibleGroups([g], new Set(['name']))).toEqual([]);
        expect(visibleGroups([g], new Set(['address']))).toEqual([g]);
    });

    it('does not descend into nested sub-groups', () => {
        const inner = group(['address'], []);
        const outer = group(['profile'], [inner]);
        expect(visibleGroups([outer], new Set(['address']))).toEqual([]);
    });
});

describe('pruneExternalAtPath', () => {
    it('drops leaves at or below the cleared path', () => {
        const issues: Issue[] = [item(['name']), item(['address']), item(['address', 'city'])];
        expect(pruneExternalAtPath(issues, 'address').map((i) => pathKey(i.path)))
            .toEqual(['name']);
    });

    it('keeps a string-prefix sibling', () => {
        const issues: Issue[] = [item(['addressLine'])];
        expect(pruneExternalAtPath(issues, 'address')).toHaveLength(1);
    });

    it('drops a group that fully matches the cleared path', () => {
        // As with rawIssuesAtPath above, the child must NOT match the target.
        // Otherwise removing the whole-group drop still yields `[]` via the
        // emptied-group path and the test passes vacuously. With a
        // non-matching child, dropping the branch pushes the group back.
        const g = group(['address'], [item(['name'])]);
        expect(pruneExternalAtPath([g], 'address')).toEqual([]);
    });

    it('keeps a non-matching group by identity when nothing inside matched', () => {
        const g = group([], [item(['name']), item(['email'])]);
        const output = pruneExternalAtPath([g], 'phone');
        expect(output).toHaveLength(1);
        expect(output[0]).toBe(g);
    });

    it('rebuilds a partially-matching group with the survivors', () => {
        const g = group([], [item(['name']), item(['email'])]);
        const output = pruneExternalAtPath([g], 'name');
        expect(output).toHaveLength(1);
        const [rebuilt] = output as [Extract<Issue, { type: 'group' }>];
        expect(rebuilt).not.toBe(g);
        expect(rebuilt.issues.map((i) => pathKey(i.path))).toEqual(['email']);
    });

    it('drops a group emptied by pruning', () => {
        const g = group([], [item(['name']), item(['name', 'first'])]);
        expect(pruneExternalAtPath([g], 'name')).toEqual([]);
    });

    it('recurses through nested groups when the child count changes', () => {
        const inner = group([], [item(['name']), item(['email'])]);
        const outer = group([], [inner, item(['name'])]);
        const output = pruneExternalAtPath([outer], 'name') as [Extract<Issue, { type: 'group' }>];
        expect(output[0].issues).toHaveLength(1);
        const [nested] = output[0].issues as [Extract<Issue, { type: 'group' }>];
        expect(nested.issues.map((i) => pathKey(i.path))).toEqual(['email']);
    });

    it('keeps a nested rebuild only when the parent child COUNT changed', () => {
        // Pins pre-existing behaviour, not desired behaviour. The
        // "did anything change?" test is `inner.length === issue.issues.length`,
        // a count comparison — so a group whose sole child was *rebuilt*
        // (same count, different content) is pushed back by identity and the
        // rebuilt child is discarded. It needs a group nested two levels deep,
        // which the core's `oneOf` does not emit today — but this function is
        // never applied to core-produced issues. Its only caller is
        // `clearExternalAtPath`, which operates on `externalIssues`, populated
        // exclusively by the public `setExternalIssues(issues: Issue[])`. So a
        // consumer or server response CAN supply two-level nesting and reach
        // it. Fixing it is a behaviour change and belongs in its own commit.
        const inner = group([], [item(['name']), item(['email'])]);
        const outer = group([], [inner]);
        const output = pruneExternalAtPath([outer], 'name');
        expect(output[0]).toBe(outer);
    });

    it('returns an empty list unchanged', () => {
        expect(pruneExternalAtPath([], 'anything')).toEqual([]);
    });
});

describe('tagExternal', () => {
    it('stamps meta.external on a leaf', () => {
        expect(tagExternal(item(['name'])).meta).toEqual({ external: true });
    });

    it('preserves pre-existing meta', () => {
        expect(tagExternal(optionalItem(['bio'])).meta).toEqual({ optional: true, external: true });
    });

    it('stamps a group AND every issue beneath it', () => {
        const nested = group([], [item(['name'])]);
        const tagged = tagExternal(group([], [nested, item(['email'])])) as
            Extract<Issue, { type: 'group' }>;
        expect(tagged.meta).toEqual({ external: true });
        const [taggedNested, taggedLeaf] = tagged.issues as [Extract<Issue, { type: 'group' }>, Issue];
        expect(taggedNested.meta).toEqual({ external: true });
        expect(taggedNested.issues[0]?.meta).toEqual({ external: true });
        expect(taggedLeaf.meta).toEqual({ external: true });
    });

    it('does not mutate the input', () => {
        const original = item(['name']);
        tagExternal(original);
        expect(original.meta).toBeUndefined();
    });
});
