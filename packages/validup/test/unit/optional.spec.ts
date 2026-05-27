/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    OptionalValue,
    ValidupError,
    flattenIssueItems,
    isIssueGroup,
    isValidupError,
} from '../../src';
import type { Issue, IssueItem } from '../../src';
import { stringValidator } from '../data';

describe('optional', () => {
    it('should work with default optionalValue', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true },
            child,
        );

        const output = await parent.run({});
        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should work with default optionalValue and optionalInclude', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            {
                optional: true,
                optionalValue: OptionalValue.UNDEFINED,
                optionalInclude: true,
            },
            child,
        );

        const output = await parent.run({});
        expect(Object.keys(output)).toHaveLength(1);
        expect(output.child).toBeUndefined();
    });

    it('should work with null optionalValue', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.NULL },
            child,
        );

        const output = await parent.run({ child: null });
        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should work with null optionalValue and optionalInclude', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            {
                optional: true,
                optionalValue: OptionalValue.NULL,
                optionalInclude: true,
            },
            child,
        );

        const output = await parent.run({ child: null });
        expect(Object.keys(output)).toHaveLength(1);
        expect(output.child).toEqual(null);
    });

    it('should work with falsy optionalValue', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.FALSY },
            child,
        );

        const output = await parent.run({ child: '' });
        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should work with falsy optionalValue and optionalInclude', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            {
                optional: true,
                optionalValue: OptionalValue.FALSY,
                optionalInclude: true,
            },
            child,
        );

        const output = await parent.run({ child: '' });
        expect(Object.keys(output)).toHaveLength(1);
        expect(output.child).toEqual('');
    });

    it('should not work with default optionalValue and invalid value', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true },
            child,
        );

        expect.assertions(1);

        try {
            await parent.run({ child: null });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not work with null optionalValue and invalid value', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.NULL },
            child,
        );

        expect.assertions(1);

        try {
            await parent.run({ child: '' });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not work with falsy optionalValue and invalid value', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.FALSY },
            child,
        );

        expect.assertions(1);

        try {
            await parent.run({ child: ' ' });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should treat empty string as missing via predicate while keeping 0', async () => {
        // Predicate use case the FALSY enum can't express: drop empty strings,
        // keep numeric zeros (0 must reach the validator).
        const container = new Container<{ name: string, count: number }>();
        container.mount(
            'name',
            { optional: (v) => v === '' || typeof v === 'undefined' },
            stringValidator,
        );
        container.mount('count', (ctx) => {
            if (typeof ctx.value !== 'number') {
                throw new Error('Value is not a number');
            }
            return ctx.value;
        });

        const output = await container.run({ name: '', count: 0 });
        expect(output.name).toBeUndefined();
        expect(output.count).toEqual(0);
    });

    it('should pass through optionalInclude with a predicate', async () => {
        const container = new Container<{ tag: string }>();
        container.mount(
            'tag',
            { optional: (v) => typeof v !== 'string', optionalInclude: true },
            stringValidator,
        );

        const output = await container.run({ tag: 42 } as any);
        expect(output.tag).toEqual(42);
    });

    describe('meta.optional tagging', () => {
        // Helper — runs a container, throws if the run unexpectedly succeeded,
        // returns the ValidupError's issues otherwise.
        async function runAndCollectIssues(
            container: Container<any>,
            input: Record<string, unknown>,
        ): Promise<Issue[]> {
            try {
                await container.run(input);
            } catch (e) {
                if (!isValidupError(e)) {
                    throw e;
                }
                return (e as ValidupError).issues;
            }
            throw new Error('expected ValidupError');
        }

        it('tags leaf issues from a boolean-optional mount with present invalid value', async () => {
            const container = new Container<{ tag: string }>();
            container.mount(
                'tag',
                { optional: true },
                stringValidator,
            );

            // Value is present (number, not undefined) → optional doesn't
            // short-circuit; the validator runs and throws.
            const issues = await runAndCollectIssues(container, { tag: 42 });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path[0] === 'tag') as IssueItem;
            expect(leaf.meta?.optional).toBe(true);
        });

        it('tags leaf issues from a predicate-optional mount when the predicate returns false', async () => {
            // Predicate optionality: any-form optional gets the flag, per
            // the user-facing intent "this mount permits optionality."
            const container = new Container<{ tag: string }>();
            container.mount(
                'tag',
                { optional: (v) => v === 'skipme' },
                stringValidator,
            );

            // Value is 42 — predicate returns false, so the validator runs
            // and throws. The mount still declared optional, so the issue
            // should be tagged.
            const issues = await runAndCollectIssues(container, { tag: 42 });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path[0] === 'tag') as IssueItem;
            expect(leaf.meta?.optional).toBe(true);
        });

        it('does NOT tag leaves inside a child container mounted as optional (no inheritance)', async () => {
            // Parent → child is optional; child → name is required.
            // If the consumer provides a child object, the child's required
            // fields stay required. The leaf at `child.foo` must not carry
            // meta.optional — only the wrapping group at `child` does.
            const child = new Container<{ foo: string }>();
            child.mount('foo', stringValidator);

            const parent = new Container();
            parent.mount(
                'child',
                { optional: true },
                child,
            );

            // Child is provided (an object) but its required `foo` is a number.
            const issues = await runAndCollectIssues(parent, { child: { foo: 42 } });

            // Wrapping group at ['child'] should carry meta.optional.
            const group = issues.find((i): i is Issue & { type: 'group' } => isIssueGroup(i) && i.path.length === 1 && i.path[0] === 'child');
            expect(group).toBeDefined();
            expect(group!.meta?.optional).toBe(true);

            // Leaf at ['child', 'foo'] should NOT carry meta.optional —
            // the child's own mount for `foo` was not optional.
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path.length === 2 && i.path[0] === 'child' && i.path[1] === 'foo') as IssueItem;
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBeUndefined();
        });

        it('tags leaves whose own child mount is also optional, independent of parent', async () => {
            // Both parent's `child` mount AND child's `foo` mount are optional.
            // Leaf at ['child', 'foo'] should carry meta.optional from its
            // OWN mount (not propagated from the parent — the parent's
            // optionality is captured by the wrapping group's meta).
            const child = new Container<{ foo: string }>();
            child.mount('foo', { optional: true }, stringValidator);

            const parent = new Container();
            parent.mount(
                'child',
                { optional: true },
                child,
            );

            const issues = await runAndCollectIssues(parent, { child: { foo: 42 } });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path.length === 2 && i.path[0] === 'child' && i.path[1] === 'foo') as IssueItem;
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBe(true);
        });

        it('does not stamp issues from a mount without optional config', async () => {
            const container = new Container<{ tag: string }>();
            container.mount('tag', stringValidator);

            const issues = await runAndCollectIssues(container, { tag: 42 });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path[0] === 'tag') as IssueItem;
            expect(leaf.meta?.optional).toBeUndefined();
        });

        it('preserves existing meta when stamping (merge, not overwrite)', async () => {
            // A validator that throws ValidupError directly (e.g. an
            // integration adapter shape) with pre-existing meta — the
            // stamping must merge, not clobber.
            const container = new Container<{ tag: string }>();
            container.mount(
                'tag',
                { optional: true },
                () => {
                    throw new ValidupError([{
                        type: 'item',
                        code: 'CUSTOM',
                        path: [],
                        message: 'boom',
                        meta: { source: 'unit-test' },
                    } as IssueItem]);
                },
            );

            const issues = await runAndCollectIssues(container, { tag: 'anything' });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path[0] === 'tag') as IssueItem;
            expect(leaf.meta?.optional).toBe(true);
            expect(leaf.meta?.source).toBe('unit-test');
        });
    });
});
