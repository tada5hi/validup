/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { 
    createApp, 
    defineComponent, 
    h, 
    nextTick, 
    reactive, 
} from 'vue';
import { Container } from 'validup';
import type { Validator } from 'validup';
import { createValidup, useValidup } from '../../src';
import type { Composable } from '../../src';

const failsAlways: Validator = (ctx) => {
    throw new Error(`validator ran on ${String(ctx.value)}`);
};

async function flush() {
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

/**
 * Mount a component that runs `useValidup` under a plugin-wired app so
 * `inject(VALIDUP_INSTALL_KEY)` resolves. Returns the `$v` composable
 * the component exposed, plus a `cleanup()` to tear the app down.
 */
function mountWithPlugin<T>(
    setup: () => { $v: Composable<T> },
    plugin?: ReturnType<typeof createValidup>,
): { v: Composable<T>; cleanup: () => void } {
    const captured: { v?: Composable<T> } = {};
    const Comp = defineComponent({
        setup() {
            const { $v } = setup();
            captured.v = $v;
            return () => h('div');
        },
    });
    const app = createApp(Comp);
    if (plugin) {
        app.use(plugin);
    }
    const root = document.createElement('div');
    app.mount(root);
    return {
        v: captured.v as Composable<T>,
        cleanup: () => app.unmount(),
    };
}

describe('useValidup optionalValue default', () => {
    it('does NOT skip empty strings by default (no install, no composable opt-in)', async () => {
        // Vue intentionally has no hard-coded form-friendly default.
        // The core default ('undefined') applies, so '' reaches the
        // validator and the form is invalid.
        const container = new Container<{ description: string }>();
        container.mount('description', { optional: true }, failsAlways);

        const state = reactive({ description: '' });
        const $v = useValidup(container, state);
        await flush();

        expect($v.$invalid.value).toBe(true);
    });

    it('install option drives the form-friendly default app-wide', async () => {
        const container = new Container<{ description: string }>();
        container.mount('description', { optional: true }, failsAlways);

        const { v, cleanup } = mountWithPlugin<{ description: string }>(
            () => {
                const state = reactive({ description: '' });
                return { $v: useValidup(container, state) };
            },
            createValidup({ optionalValue: ['undefined', 'empty_string'] }),
        );
        await flush();

        // Install fallback skips '' → no error.
        expect(v.$invalid.value).toBe(false);

        cleanup();
    });

    it('composable optionalValue overrides install', async () => {
        const container = new Container<{ description: string }>();
        container.mount('description', { optional: true }, failsAlways);

        const { v, cleanup } = mountWithPlugin<{ description: string }>(
            () => {
                const state = reactive({ description: '' });
                return {
                    $v: useValidup(container, state, {
                        // Composable narrows back to UNDEFINED only.
                        optionalValue: 'undefined',
                    }),
                };
            },
            createValidup({ optionalValue: ['undefined', 'empty_string'] }),
        );
        await flush();

        // Composable wins → '' is NOT skipped, validator runs.
        expect(v.$invalid.value).toBe(true);

        cleanup();
    });

    it('mount optionalValue still wins over both install and composable', async () => {
        const container = new Container<{ description: string }>();
        container.mount(
            'description',
            { optional: true, optionalValue: 'undefined' },
            failsAlways,
        );

        const { v, cleanup } = mountWithPlugin<{ description: string }>(
            () => {
                const state = reactive({ description: '' });
                return { $v: useValidup(container, state, { optionalValue: ['undefined', 'empty_string'] }) };
            },
            createValidup({ optionalValue: 'falsy' }),
        );
        await flush();

        // Mount-level UNDEFINED beats composable and install.
        expect(v.$invalid.value).toBe(true);

        cleanup();
    });
});

describe('useValidup optionalAs default', () => {
    it('install optionalAs collapses sentinels to a canonical value', async () => {
        const container = new Container<{ description: string | null }>();
        container.mount(
            'description',
            {
                optional: true,
                optionalValue: ['undefined', 'empty_string', 'null'],
            },
            (ctx) => ctx.value,
        );

        const { v, cleanup } = mountWithPlugin<{ description: string | null }>(
            () => {
                const state = reactive<{ description: string | null }>({ description: '' });
                return { $v: useValidup(container, state) };
            },
            createValidup({ optionalAs: null }),
        );
        await flush();

        // No error, and $validate() emits null for the canonical output.
        const result = await v.$validate();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.description).toBeNull();
        }

        cleanup();
    });

    it('composable optionalAs overrides install', async () => {
        const container = new Container<{ description: string | null }>();
        container.mount(
            'description',
            { optional: true, optionalValue: 'empty_string' },
            (ctx) => ctx.value,
        );

        const { v, cleanup } = mountWithPlugin<{ description: string | null }>(
            () => {
                const state = reactive<{ description: string | null }>({ description: '' });
                return { $v: useValidup(container, state, { optionalAs: 'COMPOSABLE' }) };
            },
            createValidup({ optionalAs: 'INSTALL' }),
        );
        await flush();

        const result = await v.$validate();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.description).toBe('COMPOSABLE');
        }

        cleanup();
    });
});
