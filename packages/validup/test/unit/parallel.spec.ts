/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import { Container, ValidupError } from '../../src';

describe('Container.run parallel mode', () => {
    it('should run independent async validators concurrently', async () => {
        // Barrier-style assertion: prove both validators have *started* before
        // either is allowed to finish. If the runtime were sequential the
        // second `started` resolution would block on the first validator's
        // completion, which can't happen until the test releases it.
        let releaseAll: (() => void) | undefined;
        const release = new Promise<void>((resolve) => {
            releaseAll = resolve;
        });
        const startedSignals: Promise<void>[] = [];
        const startedResolvers: Array<() => void> = [];

        const barrier = (label: string): Validator => {
            const idx = startedSignals.length;
            startedSignals.push(new Promise<void>((resolve) => {
                startedResolvers[idx] = resolve;
            }));
            return async () => {
                startedResolvers[idx]?.();
                await release;
                return label;
            };
        };

        const container = new Container<{ a: string, b: string }>();
        container.mount('a', barrier('A'));
        container.mount('b', barrier('B'));

        const runPromise = container.run({ a: 1, b: 1 }, { parallel: true });

        // If `parallel: true` is honored, both validators start before either
        // is released — `Promise.all(startedSignals)` resolves immediately.
        // In sequential mode this `await` would deadlock (the second
        // validator hasn't been called yet), so we cap with a short timeout
        // that clearly distinguishes the two.
        await Promise.race([
            Promise.all(startedSignals),
            new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error('timeout: validators did not start in parallel')), 200);
            }),
        ]);

        releaseAll?.();
        const out = await runPromise;
        expect(out.a).toEqual('A');
        expect(out.b).toEqual('B');
    });

    it('should aggregate failures from all parallel validators', async () => {
        const failing: Validator = async () => {
            throw new Error('boom');
        };

        const container = new Container<{ a: string, b: string }>();
        container.mount('a', failing);
        container.mount('b', failing);

        try {
            await container.run({ a: 1, b: 1 }, { parallel: true });
            expect.fail('expected ValidupError');
        } catch (e) {
            expect(e).toBeInstanceOf(ValidupError);
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(2);
            }
        }
    });

    it('should preserve registration order when issuing failures', async () => {
        const failingFirst: Validator = async () => {
            await new Promise<void>((r) => {
                setTimeout(r, 20);
            });
            throw new Error('first');
        };
        const failingSecond: Validator = async () => {
            // Resolves earlier than first, but should still come second
            // in `issues[]` because `a` was registered first.
            throw new Error('second');
        };

        const container = new Container<{ a: string, b: string }>();
        container.mount('a', failingFirst);
        container.mount('b', failingSecond);

        try {
            await container.run({ a: 1, b: 1 }, { parallel: true });
            expect.fail('expected ValidupError');
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues[0]?.path).toEqual(['a']);
                expect(e.issues[1]?.path).toEqual(['b']);
            }
        }
    });

    it('should propagate abort across parallel mounts', async () => {
        const controller = new AbortController();
        const stallable: Validator = async (ctx) => {
            await new Promise((resolve, reject) => {
                const t = setTimeout(resolve, 100);
                ctx.signal?.addEventListener('abort', () => {
                    clearTimeout(t);
                    reject(ctx.signal!.reason);
                });
            });
            return ctx.value;
        };

        const container = new Container<{ a: string, b: string }>();
        container.mount('a', stallable);
        container.mount('b', stallable);

        setTimeout(() => controller.abort(), 10);

        try {
            await container.run({ a: 1, b: 1 }, { parallel: true, signal: controller.signal });
            expect.fail('expected abort');
        } catch (e) {
            expect((e as Error).name).toEqual('AbortError');
        }
    });

    it('should forward parallel into nested containers', async () => {
        const seenOptions: any[] = [];
        const child = {
            run: async (input: any, opts: any = {}) => {
                seenOptions.push(opts);
                return input;
            },
            safeRun: async () => ({ success: true, data: {} }),
        };

        const parent = new Container<{ nested: Record<string, unknown> }>();
        parent.mount('nested', child as any);

        await parent.run({ nested: {} }, { parallel: true });

        expect(seenOptions).toHaveLength(1);
        expect(seenOptions[0].parallel).toBe(true);
    });

    it('should still honor oneOf in parallel mode', async () => {
        const fail: Validator = async () => {
            throw new Error('nope');
        };
        const ok: Validator = async (ctx) => ctx.value;

        const container = new Container<{ a: string, b: string }>({ oneOf: true });
        container.mount('a', fail);
        container.mount('b', ok);

        const out = await container.run({ a: 1, b: 'good' }, { parallel: true });
        expect(out.b).toEqual('good');
    });

    it('should still honor group filtering in parallel mode', async () => {
        const seen: string[] = [];
        const tag = (name: string): Validator => async (ctx) => {
            seen.push(name);
            return ctx.value;
        };

        const container = new Container<{ a: string, b: string }>();
        container.mount('a', { group: 'create' }, tag('a'));
        container.mount('b', { group: 'update' }, tag('b'));

        await container.run({ a: 1, b: 1 }, { parallel: true, group: 'create' });

        expect(seen).toEqual(['a']);
    });
});
