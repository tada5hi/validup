/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive, ref } from 'vue';
import { Container, defineIssueItem } from 'validup';
import type { Validator } from 'validup';
import { useValidup } from '../../src';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }
    return ctx.value;
};

const isNonEmptyString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string' || ctx.value.length === 0) {
        throw new Error('Value must be a non-empty string');
    }
    return ctx.value;
};

async function flush() {
    // Multiple cycles to drain: Vue's scheduler tick + safeRun's promise chain.
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

describe('useValidup', () => {
    it('reports invalid initially but does not surface field errors until dirty', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 1 as unknown as string });
        const $v = useValidup(container, state);

        await flush();

        expect($v.$invalid.value).toBe(true);
        expect($v.fields.name.$invalid.value).toBe(true);
        expect($v.fields.name.$dirty.value).toBe(false);
        expect($v.fields.name.$errors.value).toEqual([]); // dirty-gated
    });

    it('surfaces field errors after $touch()', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 1 as unknown as string });
        const $v = useValidup(container, state);
        await flush();

        $v.fields.name.$touch();
        await flush();

        expect($v.fields.name.$dirty.value).toBe(true);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);
    });

    it('flips $dirty automatically on $model write', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state);
        await flush();

        $v.fields.name.$model.value = 'peter';
        await flush();

        expect($v.fields.name.$dirty.value).toBe(true);
        expect(state.name).toBe('peter');
    });

    it('clears errors once a previously invalid field becomes valid', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 1 as unknown as string });
        const $v = useValidup(container, state);
        await flush();
        $v.fields.name.$touch();
        await flush();
        expect($v.fields.name.$invalid.value).toBe(true);

        $v.fields.name.$model.value = 'peter';
        await flush();

        expect($v.fields.name.$invalid.value).toBe(false);
        expect($v.fields.name.$errors.value).toEqual([]);
    });

    it('injects external issues and auto-clears them on $model write', async () => {
        const container = new Container<{ email: string }>();
        container.mount('email', isString);

        const state = reactive({ email: 'taken@example.com' });
        const $v = useValidup(container, state);
        await flush();

        $v.setExternalIssues([
            defineIssueItem({
                path: ['email'],
                message: 'email already taken',
                code: 'unique',
            }),
        ]);

        $v.fields.email.$touch();
        await flush();

        expect($v.fields.email.$invalid.value).toBe(true);
        expect($v.fields.email.$errors.value[0]?.message).toBe('email already taken');
        expect($v.fields.email.$errors.value[0]?.meta?.external).toBe(true);

        $v.fields.email.$model.value = 'fresh@example.com';
        await flush();

        expect($v.fields.email.$errors.value.find((i) => i.meta?.external)).toBeUndefined();
    });

    it('re-validates when group changes', async () => {
        const container = new Container<{ id: string; name: string }>();
        container.mount('id', { group: ['update'] }, isNonEmptyString);
        container.mount('name', { group: ['create', 'update'] }, isNonEmptyString);

        const state = reactive({ id: '', name: 'peter' });
        const group = ref<string | undefined>('create');
        const $v = useValidup(container, state, { group });
        await flush();

        // 'id' is not in the create group → no errors yet
        expect($v.$invalid.value).toBe(false);

        group.value = 'update';
        await flush();

        // 'id' is required by the update group and is empty
        expect($v.$invalid.value).toBe(true);
    });
});
