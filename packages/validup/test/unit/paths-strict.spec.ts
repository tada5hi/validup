/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import {
    Container,
    PathsStrictViolationError,
    isPathsStrictViolation,
} from '../../src';
import { stringValidator } from '../data';

const syncStringValidator: Validator = (ctx): unknown => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }
    return ctx.value;
};

describe('pathsStrict', () => {
    describe('include', () => {
        it('should run normally when every include path matches a mount', async () => {
            const container = new Container<{ foo: string, bar: string }>();
            container.mount('foo', stringValidator);
            container.mount('bar', stringValidator);

            const output = await container.run(
                { foo: 'a', bar: 'b' },
                { pathsToInclude: ['foo'], pathsStrict: true },
            );

            expect(output.foo).toEqual('a');
            expect(output.bar).toBeUndefined();
        });

        it('should throw for an include path matching no mount', async () => {
            expect.assertions(4);

            const container = new Container<{ client_id: string }>();
            container.mount('client_id', stringValidator);

            try {
                await container.run(
                    { client_id: 'x' },
                    { pathsToInclude: ['clientId'], pathsStrict: true },
                );
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
                expect(e).toBeInstanceOf(PathsStrictViolationError);
                expect((e as PathsStrictViolationError).pathsToInclude).toEqual(['clientId']);
                expect((e as PathsStrictViolationError).pathsToExclude).toEqual([]);
            }
        });

        it('should report only the unmatched entries when some match', async () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>();
            container.mount('foo', stringValidator);

            try {
                await container.run(
                    { foo: 'a' },
                    { pathsToInclude: ['foo', 'bar', 'baz'], pathsStrict: true },
                );
            } catch (e) {
                expect((e as PathsStrictViolationError).pathsToInclude).toEqual(['bar', 'baz']);
            }
        });

        it('should stay silent (existing behavior) when pathsStrict is off', async () => {
            const container = new Container<{ foo: string }>();
            container.mount('foo', stringValidator);

            const output = await container.run(
                { foo: 'a' },
                { pathsToInclude: ['clientId'] },
            );

            expect(output.foo).toBeUndefined();
        });

        it('should not throw for an empty include list', async () => {
            const container = new Container<{ foo: string }>();
            container.mount('foo', stringValidator);

            const output = await container.run(
                { foo: 'a' },
                { pathsToInclude: [], pathsStrict: true },
            );

            expect(output.foo).toBeUndefined();
        });
    });

    describe('exclude', () => {
        it('should run normally when every exclude path matches a mount', async () => {
            const container = new Container<{ foo: string, bar: string }>();
            container.mount('foo', stringValidator);
            container.mount('bar', stringValidator);

            const output = await container.run(
                { foo: 'a', bar: 'b' },
                { pathsToExclude: ['bar'], pathsStrict: true },
            );

            expect(output.foo).toEqual('a');
            expect(output.bar).toBeUndefined();
        });

        it('should throw for an exclude path matching no mount', async () => {
            expect.assertions(2);

            const container = new Container<{ foo: string }>();
            container.mount('foo', stringValidator);

            try {
                await container.run(
                    { foo: 'a' },
                    { pathsToExclude: ['bar'], pathsStrict: true },
                );
            } catch (e) {
                expect((e as PathsStrictViolationError).pathsToExclude).toEqual(['bar']);
                expect((e as PathsStrictViolationError).pathsToInclude).toEqual([]);
            }
        });
    });

    describe('resolution precedence', () => {
        it('should honor container-level pathsStrict', async () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>({
                pathsToInclude: ['bar'],
                pathsStrict: true,
            });
            container.mount('foo', stringValidator);

            try {
                await container.run({ foo: 'a' });
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
            }
        });

        it('should let run-level pathsStrict enable the check over an unset container option', async () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>({ pathsToInclude: ['bar'] });
            container.mount('foo', stringValidator);

            try {
                await container.run({ foo: 'a' }, { pathsStrict: true });
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
            }
        });
    });

    describe('nested containers', () => {
        it('should pass when a dotted include path descends to a real child mount', async () => {
            const child = new Container<{ baz: string, qux: string }>();
            child.mount('baz', stringValidator);
            child.mount('qux', stringValidator);

            const parent = new Container<{ nested: { baz: string, qux: string } }>();
            parent.mount('nested', child);

            const output = await parent.run(
                { nested: { baz: 'one', qux: 'two' } },
                { pathsToInclude: ['nested.qux'], pathsStrict: true },
            );

            expect(output.nested?.qux).toEqual('two');
            expect(output.nested?.baz).toBeUndefined();
        });

        it('should catch a renamed child mount and report the absolute path', async () => {
            expect.assertions(2);

            const child = new Container<{ quux: string }>();
            // The shared child renamed `qux` → `quux`; the parent still asks for `nested.qux`.
            child.mount('quux', stringValidator);

            const parent = new Container<{ nested: Record<string, unknown> }>();
            parent.mount('nested', child);

            try {
                await parent.run(
                    { nested: { quux: 'x' } },
                    { pathsToInclude: ['nested.qux'], pathsStrict: true },
                );
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
                // Absolute path is reconstructed from the child container's `path`.
                expect((e as PathsStrictViolationError).pathsToInclude).toEqual(['nested.qux']);
            }
        });

        it('should catch a renamed child mount even when the nested value is absent', async () => {
            expect.assertions(1);

            const child = new Container<{ quux: string }>();
            child.mount('quux', stringValidator);

            const parent = new Container<{ nested: Record<string, unknown> }>();
            parent.mount('nested', child);

            try {
                await parent.run({}, { pathsToInclude: ['nested.qux'], pathsStrict: true });
            } catch (e) {
                expect((e as PathsStrictViolationError).pathsToInclude).toEqual(['nested.qux']);
            }
        });

        it('should defer to the child for a keyless container mount', async () => {
            const child = new Container<{ qux: string }>();
            child.mount('qux', stringValidator);

            const parent = new Container<{ qux: string }>();
            parent.mount(child); // keyless — shares the parent namespace

            const output = await parent.run(
                { qux: 'two' },
                { pathsToInclude: ['qux'], pathsStrict: true },
            );

            expect(output.qux).toEqual('two');
        });

        it('should treat a keyless container subtree as a strict blind spot (no throw)', async () => {
            // A keyless container shares the parent namespace, so the parent
            // can't tell whether an unmatched path belongs to the keyless child
            // or is genuinely stale. It defers rather than throwing, and does
            // NOT forward strict into the keyless child (that would false-positive
            // on parent-sibling paths). So an unmatched path is silently ignored.
            const child = new Container<{ qux: string }>();
            child.mount('qux', stringValidator);

            const parent = new Container<{ qux: string }>();
            parent.mount(child);

            const output = await parent.run(
                { qux: 'two' },
                { pathsToInclude: ['nope'], pathsStrict: true },
            );

            expect(output.qux).toBeUndefined();
        });

        it('should NOT false-positive on a keyed sibling when a keyless container is present', async () => {
            // Regression: `foo` exists as a keyed mount; a keyless container
            // sibling must not cause strict to throw for `foo` (previously the
            // parent forwarded its full filter list + strict into the keyless
            // child, which threw because `foo` is not one of its mounts).
            const child = new Container<{ bar: string }>();
            child.mount('bar', stringValidator);

            const parent = new Container<{ foo: string, bar: string }>();
            parent.mount('foo', stringValidator);
            parent.mount(child); // keyless

            const output = await parent.run(
                { foo: 'x', bar: 'y' },
                { pathsToInclude: ['foo'], pathsStrict: true },
            );

            expect(output.foo).toEqual('x');
        });
    });

    describe('orthogonal concerns', () => {
        it('should not trip on a mount excluded from the active group', async () => {
            const container = new Container<{ foo: string }>();
            container.mount('foo', { group: ['create'] }, stringValidator);

            // `foo` is group-skipped for the `update` run, but it still exists —
            // strict mode must not treat the include path as stale.
            const output = await container.run(
                { foo: 'a' },
                {
                    group: 'update', 
                    pathsToInclude: ['foo'], 
                    pathsStrict: true, 
                },
            );

            expect(output.foo).toBeUndefined();
        });
    });

    describe('run variants', () => {
        it('should throw in parallel mode', async () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>();
            container.mount('foo', stringValidator);

            try {
                await container.run(
                    { foo: 'a' },
                    {
                        parallel: true, 
                        pathsToInclude: ['bar'], 
                        pathsStrict: true, 
                    },
                );
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
            }
        });

        it('should throw in runSync', () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>();
            container.mount('foo', syncStringValidator);

            try {
                container.runSync(
                    { foo: 'a' },
                    { pathsToInclude: ['bar'], pathsStrict: true },
                );
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
            }
        });
    });

    describe('safe variants re-throw (structural, not a Result.failure)', () => {
        it('should re-throw from safeRun', async () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>();
            container.mount('foo', stringValidator);

            try {
                await container.safeRun(
                    { foo: 'a' },
                    { pathsToInclude: ['bar'], pathsStrict: true },
                );
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
            }
        });

        it('should re-throw from safeRunSync', () => {
            expect.assertions(1);

            const container = new Container<{ foo: string }>();
            container.mount('foo', syncStringValidator);

            try {
                container.safeRunSync(
                    { foo: 'a' },
                    { pathsToExclude: ['bar'], pathsStrict: true },
                );
            } catch (e) {
                expect(isPathsStrictViolation(e)).toBe(true);
            }
        });
    });

    describe('isPathsStrictViolation guard', () => {
        it('should recognize a duck-typed error across a realm boundary', () => {
            expect(isPathsStrictViolation(new PathsStrictViolationError({ pathsToInclude: ['x'] }))).toBe(true);
            expect(isPathsStrictViolation({ name: 'PathsStrictViolationError' })).toBe(true);
            expect(isPathsStrictViolation(new Error('nope'))).toBe(false);
            expect(isPathsStrictViolation(null)).toBe(false);
            expect(isPathsStrictViolation('PathsStrictViolationError')).toBe(false);
        });
    });
});
