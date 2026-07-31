/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    ResultCache,
    ValidupError,
    defineValidator,
    isResultCache,
} from '../../src';

describe('src/cache', () => {
    describe('ResultCache', () => {
        it('round-trips entries by (mount, key)', () => {
            const cache = new ResultCache();
            const mountA = { id: 'a' };
            const mountB = { id: 'b' };

            cache.set(mountA, 'foo', {
                snapshot: {
                    value: 1, 
                    context: undefined, 
                    group: undefined, 
                },
                outcome: { ok: true, value: 1 },
            });
            expect(cache.get(mountA, 'foo')?.outcome).toEqual({ ok: true, value: 1 });
            // Different mount object → no collision.
            expect(cache.get(mountB, 'foo')).toBeUndefined();
            // Same mount, different key → separate slot.
            expect(cache.get(mountA, 'bar')).toBeUndefined();
        });

        it('delete() removes per-key or per-mount entries', () => {
            const cache = new ResultCache();
            const mount = { id: 'a' };
            cache.set(mount, 'foo', {
                snapshot: {
                    value: 1, 
                    context: undefined, 
                    group: undefined, 
                },
                outcome: { ok: true, value: 1 }, 
            });
            cache.set(mount, 'bar', {
                snapshot: {
                    value: 2, 
                    context: undefined, 
                    group: undefined, 
                },
                outcome: { ok: true, value: 2 }, 
            });

            cache.delete(mount, 'foo');
            expect(cache.get(mount, 'foo')).toBeUndefined();
            expect(cache.get(mount, 'bar')?.outcome).toEqual({ ok: true, value: 2 });

            cache.delete(mount);
            expect(cache.get(mount, 'bar')).toBeUndefined();
        });

        it('clear() wipes every entry', () => {
            const cache = new ResultCache();
            const mount = { id: 'a' };
            cache.set(mount, 'foo', {
                snapshot: {
                    value: 1, 
                    context: undefined, 
                    group: undefined, 
                },
                outcome: { ok: true, value: 1 }, 
            });
            cache.clear();
            expect(cache.get(mount, 'foo')).toBeUndefined();
        });

        it('isResultCache is duck-typed', () => {
            expect(isResultCache(new ResultCache())).toBe(true);
            expect(isResultCache({
                get: () => undefined, 
                set: () => {}, 
                delete: () => {}, 
                clear: () => {},
            })).toBe(true);
            expect(isResultCache({})).toBe(false);
            expect(isResultCache(null)).toBe(false);
        });
    });

    describe('Container.run() with cache', () => {
        it('skips a cache-hit pure validator and reuses its output', async () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return (ctx.value as string).toUpperCase();
                },
            }));

            const cache = new ResultCache();
            const data = { foo: 'bar' };

            const a = await container.run(data, { cache });
            const b = await container.run(data, { cache });

            expect(calls).toBe(1);
            expect(a.foo).toBe('BAR');
            expect(b.foo).toBe('BAR');
        });

        it('runs again when value changes', async () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            await container.run({ foo: 'a' }, { cache });
            await container.run({ foo: 'b' }, { cache });
            expect(calls).toBe(2);
        });

        it('runs again when context changes by reference', async () => {
            const container = new Container<{ foo: string }, { tenant: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            const data = { foo: 'bar' };
            await container.run(data, { cache, context: { tenant: 'a' } });
            await container.run(data, { cache, context: { tenant: 'a' } });
            // New `context` object — different identity, so cache misses.
            expect(calls).toBe(2);
        });

        it('runs again when group changes', async () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', { group: ['*'] }, defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            const data = { foo: 'bar' };
            await container.run(data, { cache, group: 'create' });
            await container.run(data, { cache, group: 'update' });
            expect(calls).toBe(2);
        });

        it('always runs a sideEffect: true validator, even on identical inputs', async () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                sideEffect: true,
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            const data = { foo: 'bar' };
            await container.run(data, { cache });
            await container.run(data, { cache });
            expect(calls).toBe(2);
        });

        it('caches a failure and replays it through the issue path on hit', async () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: () => {
                    calls += 1;
                    throw new Error('always fails');
                },
            }));

            const cache = new ResultCache();

            await expect(container.run({ foo: 'bar' }, { cache })).rejects.toThrow(ValidupError);
            await expect(container.run({ foo: 'bar' }, { cache })).rejects.toThrow(ValidupError);
            // Cached error replayed without re-running the validator.
            expect(calls).toBe(1);
        });

        it('threads the cache through nested containers', async () => {
            const inner = new Container<{ bar: string }>();
            let calls = 0;
            inner.mount('bar', defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const outer = new Container<{ foo: { bar: string } }>();
            outer.mount('foo', inner);

            const cache = new ResultCache();
            const data = { foo: { bar: 'baz' } };
            await outer.run(data, { cache });
            await outer.run(data, { cache });
            expect(calls).toBe(1);
        });

        it('does nothing when no cache is supplied', async () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const data = { foo: 'bar' };
            await container.run(data);
            await container.run(data);
            expect(calls).toBe(2);
        });
    });

    describe('Container.runSync() with cache', () => {
        it('caches and replays synchronous outcomes', () => {
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            const data = { foo: 'bar' };
            container.runSync(data, { cache });
            container.runSync(data, { cache });
            expect(calls).toBe(1);
        });

        it('does not cache a RunSyncViolationError', async () => {
            // A `RunSyncViolationError` says "this graph can't be driven
            // synchronously" — a property of the caller, not of the value. If
            // the cache-write catch stored it, the *async* run below would hit
            // the cached failure, replay it into `collectExecutionFailure`,
            // and re-raise the violation verbatim (it is structural, so the
            // fold rethrows it) — turning a perfectly valid `run()` into a
            // runSync diagnostic. Deleting the `!isStructuralThrow(e, …)`
            // guard is the mutation this case exists to kill.
            const container = new Container<{ foo: string }>();
            let calls = 0;
            container.mount('foo', defineValidator({
                run: async (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            const data = { foo: 'bar' };

            expect(() => container.runSync(data, { cache })).toThrow();
            expect(calls).toBe(1);

            await expect(container.run(data, { cache }))
                .resolves.toEqual({ foo: 'bar' });
        });

        it('does not cache a PathsStrictViolationError raised by a validator', async () => {
            // Same reasoning as the RunSyncViolationError case, for the other
            // structural error — a validator driving its own strict child
            // container can raise one. Both cache-write sites consult the
            // shared `isStructuralThrow`, so neither may remember it: a stored
            // entry would replay the violation on the next matching snapshot
            // even after the caller fixed the offending filter list.
            const child = new Container<{ inner: string }>();
            child.mount('inner', (ctx) => ctx.value);

            let strict = true;
            let calls = 0;
            const container = new Container<{ foo: string }>();
            container.mount('foo', defineValidator({
                run: async (ctx) => {
                    calls += 1;
                    return child.run(ctx.value as any, {
                        pathsStrict: strict,
                        pathsToInclude: strict ? ['nope'] : undefined,
                    });
                },
            }));

            const cache = new ResultCache();
            const data = { foo: { inner: 'bar' } as any };

            await expect(container.run(data, { cache })).rejects.toThrow();
            expect(calls).toBe(1);

            // Same snapshot, but the graph is no longer misconfigured. A
            // cached failure would make this replay the violation instead of
            // re-invoking the validator.
            strict = false;
            await expect(container.run(data, { cache }))
                .resolves.toEqual({ foo: { inner: 'bar' } });
            expect(calls).toBe(2);
        });
    });

    describe('Container.run() with parallel + cache', () => {
        it('skips parallel mounts whose snapshots match', async () => {
            const container = new Container<{ a: string, b: string }>();
            let calls = 0;
            const v = defineValidator({
                run: async (ctx) => {
                    calls += 1;
                    return ctx.value;
                },
            });
            container.mount('a', v);
            container.mount('b', v);

            const cache = new ResultCache();
            const data = { a: 'a', b: 'b' };
            await container.run(data, { cache, parallel: true });
            await container.run(data, { cache, parallel: true });
            // Two mounts × first run = 2 calls; second run is all cached.
            expect(calls).toBe(2);
        });

        it('does not cache a structural violation raised by a validator', async () => {
            // `runParallel` schedules through its own loop, so the twin body's
            // carve-out does not cover it. Before both sites shared
            // `isStructuralThrow`, this catch had no filter at all and a
            // misconfiguration was cached and replayed forever.
            const child = new Container<{ inner: string }>();
            child.mount('inner', (ctx) => ctx.value);

            let strict = true;
            let calls = 0;
            const container = new Container<{ foo: string }>();
            container.mount('foo', defineValidator({
                run: async (ctx) => {
                    calls += 1;
                    return child.run(ctx.value as any, {
                        pathsStrict: strict,
                        pathsToInclude: strict ? ['nope'] : undefined,
                    });
                },
            }));

            const cache = new ResultCache();
            const data = { foo: { inner: 'bar' } as any };

            await expect(container.run(data, { cache, parallel: true })).rejects.toThrow();
            expect(calls).toBe(1);

            strict = false;
            await expect(container.run(data, { cache, parallel: true }))
                .resolves.toEqual({ foo: { inner: 'bar' } });
            expect(calls).toBe(2);
        });
    });
});
