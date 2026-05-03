/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';
import { Container } from 'validup';
import type { Validator } from 'validup';
import { useValidup } from '../../src';

async function flush() {
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

describe('useValidup abort behaviour', () => {
    it('aborts the previous scheduled run when state changes mid-flight', async () => {
        const seen: { value: unknown; aborted: boolean }[] = [];

        const slow: Validator = async (ctx) => {
            // Honor the signal so the abort short-circuits the await.
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, 30);
                ctx.signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(ctx.signal!.reason);
                });
            });
            seen.push({ value: ctx.value, aborted: ctx.signal?.aborted ?? false });
            return ctx.value;
        };

        const container = new Container<{ name: string }>();
        container.mount('name', slow);

        const state = reactive({ name: 'a' });
        useValidup(container, state);

        // Initial run starts. Mutate before it can complete.
        await nextTick();
        state.name = 'ab';
        await nextTick();
        state.name = 'abc';

        await flush();
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });

        // Exactly one run — the final 'abc' — must complete within the
        // 50 ms wait; earlier ones are aborted before pushing into `seen`.
        // `toBe(1)` (vs. `toBeLessThanOrEqual(1)`) prevents a regression
        // where the final run also gets aborted from silently passing.
        const completed = seen.filter((s) => !s.aborted);
        expect(completed.length).toBe(1);
        expect(completed[0]?.value).toEqual('abc');
    });

    it('runs $validate without an abort signal', async () => {
        const seen: (AbortSignal | undefined)[] = [];

        const validator: Validator = (ctx) => {
            seen.push(ctx.signal);
            return ctx.value;
        };

        const container = new Container<{ name: string }>();
        container.mount('name', validator);

        const state = reactive({ name: 'a' });
        const $v = useValidup(container, state, { lazy: true });

        const result = await $v.$validate();

        expect(result.success).toBe(true);
        expect(seen).toHaveLength(1);
        // The submit-time run carries no signal — so an intervening
        // state-change-driven schedule cannot abort it.
        expect(seen[0]).toBeUndefined();
    });
});
