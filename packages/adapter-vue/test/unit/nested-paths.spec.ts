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

describe('nested paths', () => {
    it('reads $model via dotted key', async () => {
        const container = new Container<{ user: { email: string } }>();
        const child = new Container<{ email: string }>();
        child.mount('email', isNonEmptyString);
        container.mount('user', child);

        const state = reactive({ user: { email: 'peter@example.com' } });
        const $v = useValidup(container, state);
        await flush();

        expect($v.fields['user.email'].$model.value).toBe('peter@example.com');
    });

    it('writes $model via dotted key and creates intermediate objects', async () => {
        const container = new Container<{ address: { city: string } }>();
        const child = new Container<{ city: string }>();
        child.mount('city', isNonEmptyString);
        container.mount('address', child);

        const state = reactive({} as { address?: { city: string } });
        const $v = useValidup(container, state as { address: { city: string } });
        await flush();

        $v.fields['address.city'].$model.value = 'Berlin';
        await flush();

        expect(state.address?.city).toBe('Berlin');
        expect($v.fields['address.city'].$dirty.value).toBe(true);
    });

    it('supports bracket notation for array indices', async () => {
        const state = reactive({ tags: ['', ''] });
        const container = new Container<{ tags: string[] }>();
        const $v = useValidup(container, state);
        await flush();

        $v.fields['tags[0]'].$model.value = 'urgent';
        await flush();

        expect(state.tags[0]).toBe('urgent');
        expect($v.fields['tags[0]'].$dirty.value).toBe(true);
    });

    it('surfaces nested errors when an ancestor path is dirty', async () => {
        const container = new Container<{ address: { city: string } }>();
        const child = new Container<{ city: string }>();
        child.mount('city', isNonEmptyString);
        container.mount('address', child);

        const state = reactive({ address: { city: '' } });
        const $v = useValidup(container, state);
        await flush();

        // marking the parent dirty surfaces the descendant error
        $v.fields.address.$touch();
        await flush();

        expect($v.fields['address.city'].$errors.value.length).toBeGreaterThan(0);
        expect($v.fields.address.$invalid.value).toBe(true);
    });

    it('treats descendant-only dirty paths correctly', async () => {
        const container = new Container<{ address: { city: string } }>();
        const child = new Container<{ city: string }>();
        child.mount('city', isNonEmptyString);
        container.mount('address', child);

        const state = reactive({ address: { city: '' } });
        const $v = useValidup(container, state);
        await flush();

        // touch only the leaf — sibling/parent fields should not auto-surface their own state
        $v.fields['address.city'].$touch();
        await flush();

        expect($v.fields['address.city'].$dirty.value).toBe(true);
        // parent reports invalid because it has descendant errors, but $dirty is the leaf-only state
        expect($v.fields['address.city'].$errors.value.length).toBeGreaterThan(0);
    });

    it('whole-form $errors honours prefix-dirty matching', async () => {
        const container = new Container<{ user: { email: string }; tags: string[] }>();
        const userChild = new Container<{ email: string }>();
        userChild.mount('email', isNonEmptyString);
        container.mount('user', userChild);
        container.mount('tags[0]', isNonEmptyString);

        const state = reactive({ user: { email: '' }, tags: [''] });
        const $v = useValidup(container, state);
        await flush();

        expect($v.$errors.value).toEqual([]);

        $v.fields.user.$touch();
        await flush();

        // user.* errors surface; tags[0] does not (different prefix)
        expect($v.$errors.value.some((i) => String(i.path[0]) === 'user')).toBe(true);
        expect($v.$errors.value.some((i) => String(i.path[0]) === 'tags')).toBe(false);
    });
});
