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

const isNonEmptyString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string' || ctx.value.length === 0) {
        throw new Error('Value must be a non-empty string');
    }
    return ctx.value;
};

async function flush() {
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

describe('$validate', () => {
    it('returns the run result and reflects current state', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const result = await $v.$validate();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('peter');
        }
    });

    it('marks every state key dirty so severity escalates from warning to error', async () => {
        const container = new Container<{ name: string; email: string }>();
        container.mount('name', isNonEmptyString);
        container.mount('email', isNonEmptyString);

        const state = reactive({ name: '', email: '' });
        const $v = useValidup(container, state);
        await flush();

        // before validate: dirty isn't flipped yet, but required-mount
        // errors are already visible in `$errors` (the schema doesn't permit
        // emptiness, so the form should communicate the gap right away).
        expect($v.fields.name.$dirty.value).toBe(false);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);

        const result = await $v.$validate();
        expect(result.success).toBe(false);

        await flush();
        // `$validate` marks every state key dirty so severity flips from
        // `'warning'` (pristine) to `'error'` (engaged) on every field.
        expect($v.fields.name.$dirty.value).toBe(true);
        expect($v.fields.email.$dirty.value).toBe(true);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);
    });

    it('surfaces $errors for validation paths absent from state (regression: copilot review #353)', async () => {
        const container = new Container<{ address: { city: string } }>();
        const child = new Container<{ city: string }>();
        child.mount('city', isNonEmptyString);
        container.mount('address', child);

        // State starts empty — no `address` key. The container still
        // validates `address.city`. Without `$validate()` marking issue
        // paths dirty, `$errors` would stay empty here.
        const state = reactive({} as { address?: { city: string } });
        const $v = useValidup(container, state as { address: { city: string } });
        await flush();

        const result = await $v.$validate();
        expect(result.success).toBe(false);
        await flush();

        expect($v.$errors.value.length).toBeGreaterThan(0);
        expect($v.fields.at('address.city').$errors.value.length).toBeGreaterThan(0);
    });

    it('cancels a pending debounce timer (stale debounced runs cannot overwrite the result)', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state, { debounce: 50 });
        await flush();

        // Trigger a debounced run by writing $model — schedule fires, real run pending.
        $v.fields.name.$model.value = '';
        // Within the debounce window, call $validate — must clear the timer
        // and use the live (empty) state.
        const result = await $v.$validate();
        expect(result.success).toBe(false);

        // Wait long enough for the cancelled timer to have fired had it not been cleared.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 80);
        });

        // No interleaving stale run should have succeeded.
        expect($v.$invalid.value).toBe(true);
    });
});

describe('hydration', () => {
    it('direct state writes do not flip $dirty', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state);
        await flush();

        // Simulate `assignFormProperties(state, entity)` — the dominant authup hydration pattern.
        Object.assign(state, { name: 'peter' });
        await flush();

        expect($v.fields.name.$dirty.value).toBe(false);
        expect($v.fields.name.$invalid.value).toBe(false);
        expect($v.fields.name.$errors.value).toEqual([]);
    });

    it('hydration leaves $dirty false; required-mount errors are visible, $touch escalates them', async () => {
        const container = new Container<{ name: string; email: string }>();
        container.mount('name', isNonEmptyString);
        container.mount('email', isNonEmptyString);

        const state = reactive({ name: '', email: '' });
        const $v = useValidup(container, state);
        await flush();

        // Hydrate from "loaded entity" — `Object.assign` writes around
        // `$model`, so `$dirty` stays false. Required-mount errors are
        // already in `$errors` (severity → `'warning'`) so the form can
        // hint at missing data without the user touching every field.
        Object.assign(state, { name: '', email: '' });
        await flush();
        expect($v.fields.name.$dirty.value).toBe(false);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);

        // Force everything visible (e.g. on entering edit mode) — severity
        // flips from `'warning'` to `'error'`; optional-mount items (none
        // here) would also start surfacing.
        $v.$touch();
        await flush();

        expect($v.fields.name.$dirty.value).toBe(true);
        expect($v.fields.email.$dirty.value).toBe(true);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);
        expect($v.fields.email.$errors.value.length).toBeGreaterThan(0);
    });

    it('$reset() returns to clean after edits', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state);
        await flush();

        $v.fields.name.$model.value = 'partial';
        await flush();
        expect($v.fields.name.$dirty.value).toBe(true);

        // Server-driven reset: clear dirty, then assign new server values.
        $v.$reset();
        Object.assign(state, { name: 'peter' });
        await flush();

        expect($v.fields.name.$dirty.value).toBe(false);
        expect($v.fields.name.$errors.value).toEqual([]);
        expect(state.name).toBe('peter');
    });

    it('field-level $touch surfaces a single nested path', async () => {
        const container = new Container<{ user: { email: string } }>();
        const child = new Container<{ email: string }>();
        child.mount('email', isNonEmptyString);
        container.mount('user', child);

        const state = reactive({ user: { email: '' } });
        const $v = useValidup(container, state);
        await flush();

        $v.fields.at('user.email').$touch();
        await flush();

        expect($v.fields.at('user.email').$errors.value.length).toBeGreaterThan(0);
    });
});
