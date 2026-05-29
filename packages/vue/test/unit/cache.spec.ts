/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive, ref } from 'vue';
import { Container, defineValidator } from 'validup';
import { useValidup } from '../../src';

async function flush() {
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

describe('useValidup cache', () => {
    it('skips non-side-effect validators when their inputs are unchanged', async () => {
        const container = new Container<{ name: string }>();
        let calls = 0;
        container.mount('name', defineValidator({
            run: (ctx) => {
                calls += 1;
                return ctx.value;
            },
        }));

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const initialCalls = calls;
        expect(initialCalls).toBeGreaterThan(0);

        // Force a fresh validate-on-submit pass — value didn't change, so
        // the cached outcome should replay without touching the validator.
        await $v.$validate();
        expect(calls).toBe(initialCalls);
    });

    it('re-runs when value changes', async () => {
        const container = new Container<{ name: string }>();
        let calls = 0;
        container.mount('name', defineValidator({
            run: (ctx) => {
                calls += 1;
                return ctx.value;
            },
        }));

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const baseline = calls;
        $v.fields.name.$model.value = 'paul';
        await flush();
        expect(calls).toBe(baseline + 1);
    });

    it('always re-runs sideEffect: true validators', async () => {
        const container = new Container<{ name: string }>();
        let calls = 0;
        container.mount('name', defineValidator({
            sideEffect: true,
            run: (ctx) => {
                calls += 1;
                return ctx.value;
            },
        }));

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const baseline = calls;
        // $validate() with unchanged value would skip a non-side-effect
        // validator; sideEffect: true forces a fresh run.
        await $v.$validate();
        expect(calls).toBe(baseline + 1);
    });

    it('$reset() clears the cache', async () => {
        const container = new Container<{ name: string }>();
        let calls = 0;
        container.mount('name', defineValidator({
            run: (ctx) => {
                calls += 1;
                return ctx.value;
            },
        }));

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const baseline = calls;
        $v.$reset();
        await $v.$validate();
        // After $reset() the cache is empty, so the validator runs again
        // even though the value didn't change.
        expect(calls).toBe(baseline + 1);
    });

    it('clears the cache when the container reference swaps', async () => {
        const containerA = new Container<{ name: string }>();
        let aCalls = 0;
        containerA.mount('name', defineValidator({
            run: (ctx) => {
                aCalls += 1;
                return ctx.value;
            },
        }));

        const containerB = new Container<{ name: string }>();
        let bCalls = 0;
        containerB.mount('name', defineValidator({
            run: (ctx) => {
                bCalls += 1;
                return ctx.value;
            },
        }));

        const containerRef = ref(containerA);
        const state = reactive({ name: 'peter' });
        const $v = useValidup(containerRef, state);
        await flush();

        expect(aCalls).toBeGreaterThan(0);
        expect(bCalls).toBe(0);

        containerRef.value = containerB;
        await flush();

        // Container B is now active — its validator must run; the cache
        // from container A must not leak.
        expect(bCalls).toBeGreaterThan(0);
    });
});
