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
    it('should work with default optionalValue (UNDEFINED)', async () => {
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

    describe('atomic optionalValue', () => {
        // Each atom matches exactly one runtime value (FALSY is the only
        // composite). These specs lock the contract — a regression that
        // widens an atom (e.g. NULL → null|undefined like pre-2.0) trips here.
        function buildContainer(optionalValue: any): Container<{ x: any }> {
            const c = new Container<{ x: any }>();
            c.mount('x', {
                optional: true, 
                optionalValue, 
                optionalInclude: true, 
            }, (ctx) => {
                throw new Error(`validator ran on ${String(ctx.value)}`);
            });
            return c;
        }

        it('NULL matches null only, NOT undefined', async () => {
            const c = buildContainer(OptionalValue.NULL);
            // null → optional → skipped (validator never throws), value preserved via optionalInclude
            await expect(c.run({ x: null })).resolves.toEqual({ x: null });
            // undefined → NOT optional under atomic NULL → validator runs → throws
            await expect(c.run({ x: undefined })).rejects.toBeDefined();
        });

        it('EMPTY_STRING matches "" only', async () => {
            const c = buildContainer(OptionalValue.EMPTY_STRING);
            await expect(c.run({ x: '' })).resolves.toEqual({ x: '' });
            await expect(c.run({ x: ' ' })).rejects.toBeDefined();
            await expect(c.run({ x: 0 })).rejects.toBeDefined();
        });

        it('ZERO matches 0 only', async () => {
            const c = buildContainer(OptionalValue.ZERO);
            await expect(c.run({ x: 0 })).resolves.toEqual({ x: 0 });
            await expect(c.run({ x: 1 })).rejects.toBeDefined();
            await expect(c.run({ x: false })).rejects.toBeDefined();
        });

        it('FALSE matches false only', async () => {
            const c = buildContainer(OptionalValue.FALSE);
            await expect(c.run({ x: false })).resolves.toEqual({ x: false });
            await expect(c.run({ x: 0 })).rejects.toBeDefined();
            await expect(c.run({ x: '' })).rejects.toBeDefined();
        });

        it('NAN matches NaN only', async () => {
            const c = buildContainer(OptionalValue.NAN);
            const result = await c.run({ x: Number.NaN });
            expect(Number.isNaN(result.x)).toBe(true);
            await expect(c.run({ x: 0 })).rejects.toBeDefined();
            // String "NaN" is not a numeric NaN.
            await expect(c.run({ x: 'NaN' })).rejects.toBeDefined();
        });
    });

    describe('array optionalValue', () => {
        it('matches if any atom matches', async () => {
            const container = new Container<{ x: any }>();
            container.mount(
                'x',
                {
                    optional: true,
                    optionalValue: [OptionalValue.NULL, OptionalValue.UNDEFINED, OptionalValue.EMPTY_STRING],
                    optionalInclude: true,
                },
                (ctx) => {
                    throw new Error(`validator ran on ${String(ctx.value)}`);
                },
            );

            await expect(container.run({ x: null })).resolves.toEqual({ x: null });
            await expect(container.run({ x: undefined })).resolves.toEqual({ x: undefined });
            await expect(container.run({ x: '' })).resolves.toEqual({ x: '' });
            // `0` and `false` are NOT in the list — validator runs.
            await expect(container.run({ x: 0 })).rejects.toBeDefined();
            await expect(container.run({ x: false })).rejects.toBeDefined();
        });

        it('empty array never matches (effectively non-optional)', async () => {
            const container = new Container<{ x: any }>();
            container.mount(
                'x',
                { optional: true, optionalValue: [] },
                (ctx) => {
                    throw new Error(`validator ran on ${String(ctx.value)}`);
                },
            );

            await expect(container.run({ x: undefined })).rejects.toBeDefined();
            await expect(container.run({ x: '' })).rejects.toBeDefined();
        });

        it('composite FALSY mixed with atoms is harmless (any-of)', async () => {
            const container = new Container<{ x: any }>();
            container.mount(
                'x',
                {
                    optional: true,
                    // FALSY already subsumes the others — exercising the
                    // "redundant atoms are silent" path.
                    optionalValue: [OptionalValue.FALSY, OptionalValue.UNDEFINED],
                    optionalInclude: true,
                },
                (ctx) => {
                    throw new Error(`validator ran on ${String(ctx.value)}`);
                },
            );

            await expect(container.run({ x: 0 })).resolves.toEqual({ x: 0 });
            await expect(container.run({ x: '' })).resolves.toEqual({ x: '' });
            await expect(container.run({ x: 'x' })).rejects.toBeDefined();
        });
    });

    describe('ContainerRunOptions.optionalValue (run-level fallback)', () => {
        it('applies when the mount does not set its own optionalValue', async () => {
            const container = new Container<{ x: any }>();
            container.mount(
                'x',
                { optional: true, optionalInclude: true },
                (ctx) => {
                    throw new Error(`validator ran on ${String(ctx.value)}`);
                },
            );

            // No mount-level optionalValue + run-level ['undefined', 'empty_string']
            // → '' is skipped.
            await expect(
                container.run({ x: '' }, { optionalValue: ['undefined', 'empty_string'] }),
            ).resolves.toEqual({ x: '' });

            // Same container WITHOUT the run-level fallback falls back to the
            // core default ('undefined') — '' reaches the validator.
            await expect(container.run({ x: '' })).rejects.toBeDefined();
        });

        it('per-mount optionalValue wins over the run-level fallback', async () => {
            const container = new Container<{ x: any }>();
            container.mount(
                'x',
                {
                    optional: true,
                    // Mount-level wins → only `undefined` is skipped, even if
                    // the run-level broadens to falsy.
                    optionalValue: OptionalValue.UNDEFINED,
                    optionalInclude: true,
                },
                (ctx) => {
                    throw new Error(`validator ran on ${String(ctx.value)}`);
                },
            );

            await expect(
                container.run({ x: undefined }, { optionalValue: OptionalValue.FALSY }),
            ).resolves.toEqual({ x: undefined });

            // '' falls through to the mount-level UNDEFINED, NOT the run-level
            // FALSY → validator runs.
            await expect(
                container.run({ x: '' }, { optionalValue: OptionalValue.FALSY }),
            ).rejects.toBeDefined();
        });

        it('is forwarded into nested containers', async () => {
            const child = new Container<{ inner: string }>();
            child.mount(
                'inner',
                { optional: true, optionalInclude: true },
                (ctx) => {
                    throw new Error(`validator ran on ${String(ctx.value)}`);
                },
            );

            const parent = new Container<{ wrap: { inner: string } }>();
            parent.mount('wrap', child);

            // Run-level `['undefined', 'empty_string']` on the parent should
            // reach the child's mount via forwarding — otherwise child would
            // run its validator on the empty string.
            await expect(
                parent.run(
                    { wrap: { inner: '' } },
                    { optionalValue: ['undefined', 'empty_string'] },
                ),
            ).resolves.toEqual({ wrap: { inner: '' } });
        });
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
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBe(true);
        });

        it('does NOT tag issues from a predicate-optional mount', async () => {
            // Predicate optionality is a fine-grained per-value statement;
            // when the validator fires, the predicate already returned false
            // (otherwise the validator would have been skipped), so the
            // blanket "this mount is optional" claim isn't accurate.
            const container = new Container<{ tag: string }>();
            container.mount(
                'tag',
                { optional: (v) => v === 'skipme' },
                stringValidator,
            );

            // Value is 42 — predicate returns false, so the validator runs
            // and throws. Tag should NOT be present.
            const issues = await runAndCollectIssues(container, { tag: 42 });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path[0] === 'tag') as IssueItem;
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBeUndefined();
        });

        it('does NOT tag issues when optional is explicitly false', async () => {
            // `optional: false` matches the runtime's truthy check elsewhere
            // — treated as not optional — so the tag must NOT be set.
            const container = new Container<{ tag: string }>();
            container.mount(
                'tag',
                { optional: false },
                stringValidator,
            );

            const issues = await runAndCollectIssues(container, { tag: 42 });
            const leaves = flattenIssueItems(issues);
            const leaf = leaves.find((i) => i.path[0] === 'tag') as IssueItem;
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBeUndefined();
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
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBeUndefined();
        });

        it('recursively tags leaves inside an IssueGroup thrown by a validator', async () => {
            // Some integration adapters might throw `ValidupError([
            //   defineIssueGroup({ issues: [leaf1, leaf2] }),
            // ])`. Without deep stamping, `flattenIssueItems` reaches in,
            // pulls the leaves, and they'd surface to consumers WITHOUT
            // meta.optional — breaking severity gating downstream.
            const container = new Container<{ tag: string }>();
            container.mount(
                'tag',
                { optional: true },
                () => {
                    throw new ValidupError([{
                        type: 'group',
                        path: [],
                        message: 'two-leaf group',
                        issues: [
                            {
                                type: 'item', 
                                code: 'A', 
                                path: ['inner-a'], 
                                message: 'a', 
                            } as IssueItem,
                            {
                                type: 'item', 
                                code: 'B', 
                                path: ['inner-b'], 
                                message: 'b', 
                            } as IssueItem,
                        ],
                    } as Issue]);
                },
            );

            const issues = await runAndCollectIssues(container, { tag: 'anything' });
            const leaves = flattenIssueItems(issues);
            expect(leaves.length).toBeGreaterThanOrEqual(2);
            for (const leaf of leaves) {
                expect(leaf.meta?.optional).toBe(true);
            }
        });

        it('does not mutate the validator\'s original error.issues[i].meta', async () => {
            // Regression guard: an earlier implementation mutated
            // `issue.meta.optional = true` in place. Because the bubbled-up
            // issue's `meta` is a shallow reference to the validator's
            // original `ValidupError.issues[i].meta`, that mutation leaked
            // back — and a validator that caches/replays its error would
            // accumulate stale `optional` flags. The fix is to reassign
            // `issue.meta` to a fresh object; the validator's own object
            // must stay untouched.
            const originalMeta = { source: 'unit-test' };
            const validatorError = new ValidupError([{
                type: 'item',
                code: 'CUSTOM',
                path: [],
                message: 'boom',
                meta: originalMeta,
            } as IssueItem]);

            const container = new Container<{ tag: string }>();
            container.mount('tag', { optional: true }, () => {
                throw validatorError;
            });

            try {
                await container.run({ tag: 'anything' });
            } catch (e) {
                if (!isValidupError(e)) throw e;
            }

            // The validator's original meta object must be untouched.
            expect(originalMeta).toEqual({ source: 'unit-test' });
            expect((originalMeta as Record<string, unknown>).optional).toBeUndefined();
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
            expect(leaf).toBeDefined();
            expect(leaf.meta?.optional).toBe(true);
            expect(leaf.meta?.source).toBe('unit-test');
        });
    });
});
