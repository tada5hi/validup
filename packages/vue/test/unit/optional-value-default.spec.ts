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

describe('useValidup optionalValue default', () => {
    it('skips empty-string mounts by default (form-input idiom)', async () => {
        // Core default is UNDEFINED, but @validup/vue threads
        // ['undefined', 'empty_string'] as the run-level fallback so an
        // untouched <input> bound via v-model (holding '') counts as
        // missing without per-mount configuration.
        const container = new Container<{ description: string }>();
        container.mount('description', { optional: true }, failsAlways);

        const state = reactive({ description: '' });
        const $v = useValidup(container, state);
        await flush();

        // No issue surfaced — the validator was skipped, not failed-but-hidden.
        expect($v.$errors.value).toEqual([]);
        expect($v.$invalid.value).toBe(false);
    });

    it('still runs the validator on a non-empty value', async () => {
        const container = new Container<{ description: string }>();
        container.mount('description', { optional: true }, failsAlways);

        const state = reactive({ description: 'a' });
        const $v = useValidup(container, state);
        await flush();

        // 'a' is truthy and not '' — not optional, validator runs and fails.
        expect($v.$invalid.value).toBe(true);
    });

    it('honors composable-level optionalValue override', async () => {
        // Form author opts back into the core conservative default.
        const container = new Container<{ description: string }>();
        container.mount('description', { optional: true }, failsAlways);

        const state = reactive({ description: '' });
        const $v = useValidup(container, state, { optionalValue: 'undefined' });
        await flush();

        // Override: empty string no longer skipped — validator runs and fails.
        expect($v.$invalid.value).toBe(true);
    });

    it('per-mount optionalValue still wins over the composable default', async () => {
        // Composable default is ['undefined', 'empty_string'], but this mount
        // narrows to UNDEFINED so '' reaches the validator.
        const container = new Container<{ description: string }>();
        container.mount(
            'description',
            { optional: true, optionalValue: 'undefined' },
            failsAlways,
        );

        const state = reactive({ description: '' });
        const $v = useValidup(container, state);
        await flush();

        // Mount-level UNDEFINED beats the run-level default → validator runs.
        expect($v.$invalid.value).toBe(true);
    });
});
