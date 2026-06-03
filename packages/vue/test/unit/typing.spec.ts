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
import type { Composable, FieldState } from '../../src';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value must be a string');
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

// Compile-time only — these assertions live in declarations so they fail
// `tsc --noEmit` if the typing regresses. No runtime assertions needed.
type User = {
    id: number,
    name: string,
    email: string,
    createdAt: Date,
};

describe('typing: fields strict-mode access (issue #391)', () => {
    it('typed key access returns FieldState<T[K]> (never undefined)', async () => {
        const container = new Container<User>();
        container.mount('name', isString);

        const state = reactive({ name: '', email: '' });
        const $v = useValidup(container, state);
        await flush();

        // Compile-time: `$v.fields.name` must be `FieldState<string>`, not
        // `FieldState<string> | undefined`. Strict equality with a non-null
        // target proves the absence of `| undefined` in the inferred type.
        const nameField: FieldState<string> = $v.fields.name;
        expect(nameField).toBeDefined();
    });

    it('fields.at(path) accepts dotted / bracketed paths', async () => {
        const container = new Container<{ user: { email: string }; tags: string[] }>();
        const child = new Container<{ email: string }>();
        child.mount('email', isString);
        container.mount('user', child);

        const state = reactive({ user: { email: 'peter@example.com' }, tags: ['urgent'] });
        const $v = useValidup(container, state);
        await flush();

        expect($v.fields.at('user.email').$model.value).toBe('peter@example.com');
        expect($v.fields.at('tags[0]').$model.value).toBe('urgent');

        // Returned identity should match what typed-key access returns for
        // the same path — both go through the same FieldState cache.
        const a = $v.fields.at('user');
        const b = $v.fields.user;
        expect(a).toBe(b);
    });

    it('fields.at returns a typed FieldState (generic V)', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const named: FieldState<string> = $v.fields.at<string>('name');
        expect(named.$model.value).toBe('peter');
    });
});

describe('typing: state accepts Partial<T> (issue #392)', () => {
    it('accepts a form narrower than the container entity', async () => {
        const container = new Container<User>();
        container.mount('name', isString);
        container.mount('email', isString);

        // Form omits `id` / `createdAt` — server-set fields not relevant to
        // the validator. Pre-fix this required `form as any`.
        const form = reactive({ name: 'peter', email: 'peter@example.com' });
        const $v: Composable<User> = useValidup(container, form);
        await flush();

        // T stays bound to User, so typed-key access still works against
        // the entity shape, not the narrower form.
        const nameField: FieldState<string> = $v.fields.name;
        expect(nameField.$model.value).toBe('peter');
        expect($v.fields.email.$model.value).toBe('peter@example.com');
    });

    it('accepts an empty form (every field is optional in Partial<T>)', async () => {
        const container = new Container<User>();
        container.mount('name', isString);

        const form = reactive({} as Partial<User>);
        const $v: Composable<User> = useValidup(container, form);
        await flush();

        // Form starts empty; writing through $model populates state.
        $v.fields.name.$model.value = 'peter';
        await flush();
        expect(form.name).toBe('peter');
    });
});
