/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { TwinBody } from '../../src/utils/twin';
import { op, runTwinAsync, runTwinSync } from '../../src/utils/twin';

describe('twin', () => {
    it('should drive the side the driver stands for', async () => {
        const seen: string[] = [];

        function* body() : TwinBody<string> {
            return yield* op(
                () => {
                    seen.push('async');
                    return Promise.resolve('a');
                },
                () => {
                    seen.push('sync');
                    return 's';
                },
            );
        }

        expect(await runTwinAsync(body())).toEqual('a');
        expect(runTwinSync(body())).toEqual('s');
        expect(seen).toEqual(['async', 'sync']);
    });

    it('should await a bare (non-promise) async thunk return', async () => {
        function* body() : TwinBody<number> {
            return yield* op(() => 1, () => 1);
        }

        expect(await runTwinAsync(body())).toEqual(1);
    });

    it('should thread each effect result back into the body', async () => {
        function* body() : TwinBody<number> {
            const a = yield* op(() => Promise.resolve(2), () => 2);
            const b = yield* op(() => Promise.resolve(a * 3), () => a * 3);
            return b + 1;
        }

        expect(await runTwinAsync(body())).toEqual(7);
        expect(runTwinSync(body())).toEqual(7);
    });

    it('should re-enter effect errors so in-body try/catch behaves identically', async () => {
        function* body() : TwinBody<string> {
            try {
                yield* op(
                    () => Promise.reject(new Error('async boom')),
                    () => {
                        throw new Error('sync boom');
                    },
                );
                return 'not reached';
            } catch (e) {
                return `caught: ${(e as Error).message}`;
            }
        }

        expect(await runTwinAsync(body())).toEqual('caught: async boom');
        expect(runTwinSync(body())).toEqual('caught: sync boom');
    });

    it('should run in-body finally blocks on both sides', async () => {
        const seen: string[] = [];

        function* body() : TwinBody<void> {
            try {
                yield* op(
                    () => Promise.reject(new Error('boom')),
                    () => {
                        throw new Error('boom');
                    },
                );
            } catch {
                seen.push('catch');
            } finally {
                seen.push('finally');
            }
        }

        await runTwinAsync(body());
        runTwinSync(body());

        expect(seen).toEqual(['catch', 'finally', 'catch', 'finally']);
    });

    it('should propagate an uncaught effect error out of the driver', async () => {
        function* body() : TwinBody<void> {
            yield* op(
                () => Promise.reject(new Error('escapes')),
                () => {
                    throw new Error('escapes');
                },
            );
        }

        await expect(runTwinAsync(body())).rejects.toThrow('escapes');
        expect(() => runTwinSync(body())).toThrow('escapes');
    });

    it('should compose bodies via yield* delegation', async () => {
        function* inner(input: number) : TwinBody<number> {
            return yield* op(() => Promise.resolve(input * 2), () => input * 2);
        }

        function* outer() : TwinBody<number> {
            const a = yield* inner(2);
            const b = yield* inner(a);
            return b;
        }

        expect(await runTwinAsync(outer())).toEqual(8);
        expect(runTwinSync(outer())).toEqual(8);
    });

    it('should not introduce a microtask on the sync side', () => {
        let flushed = false;
        Promise.resolve().then(() => {
            flushed = true;
        });

        function* body() : TwinBody<boolean> {
            return yield* op(() => Promise.resolve(flushed), () => flushed);
        }

        expect(runTwinSync(body())).toEqual(false);
        expect(flushed).toEqual(false);
    });
});
