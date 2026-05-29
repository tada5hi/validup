/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    ValidationCache,
    ValidupError,
    defineValidator,
    isValidationCache,
} from '../../src';

describe('src/cache', () => {
    describe('ValidationCache', () => {
        it('round-trips entries by (mount, key)', () => {
            const cache = new ValidationCache();
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
            const cache = new ValidationCache();
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
            const cache = new ValidationCache();
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

        it('isValidationCache is duck-typed', () => {
            expect(isValidationCache(new ValidationCache())).toBe(true);
            expect(isValidationCache({
                get: () => undefined, 
                set: () => {}, 
                delete: () => {}, 
                clear: () => {},
            })).toBe(true);
            expect(isValidationCache({})).toBe(false);
            expect(isValidationCache(null)).toBe(false);
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

            const cache = new ValidationCache();
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

            const cache = new ValidationCache();
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

            const cache = new ValidationCache();
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

            const cache = new ValidationCache();
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

            const cache = new ValidationCache();
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

            const cache = new ValidationCache();

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

            const cache = new ValidationCache();
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

            const cache = new ValidationCache();
            const data = { foo: 'bar' };
            container.runSync(data, { cache });
            container.runSync(data, { cache });
            expect(calls).toBe(1);
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

            const cache = new ValidationCache();
            const data = { a: 'a', b: 'b' };
            await container.run(data, { cache, parallel: true });
            await container.run(data, { cache, parallel: true });
            // Two mounts × first run = 2 calls; second run is all cached.
            expect(calls).toBe(2);
        });
    });
});
