/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive, ref } from 'vue';
import { Container, OptionalValue } from 'validup';
import type { Validator } from 'validup';
import { useValidup } from '../../src';

const isNonEmptyString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string' || ctx.value.length === 0) {
        throw new Error('Value must be a non-empty string');
    }
    return ctx.value;
};

type Role = { name: string; description: string };

class RoleValidator extends Container<Role> {
    protected override initialize() {
        super.initialize();

        this.mount('name', { group: 'create' }, isNonEmptyString);
        this.mount('name', {
            group: 'update', 
            optional: true, 
            optionalValue: OptionalValue.FALSY, 
        }, isNonEmptyString);
        this.mount('description', { optional: true, optionalValue: OptionalValue.FALSY }, isNonEmptyString);
    }
}

async function flush() {
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

describe('initialize() subclass pattern', () => {
    it('runs mounts registered in initialize() under the create group', async () => {
        const state = reactive({ name: '', description: '' });
        const $v = useValidup(new RoleValidator(), state, { group: 'create' });
        await flush();

        expect($v.$invalid.value).toBe(true);
        expect($v.fields.name.$invalid.value).toBe(true);
    });

    it('honours per-mount group filtering', async () => {
        const state = reactive({ name: '', description: '' });
        const group = ref<'create' | 'update'>('create');
        const $v = useValidup(new RoleValidator(), state, { group });
        await flush();

        // 'create' requires non-empty name → invalid
        expect($v.$invalid.value).toBe(true);

        group.value = 'update';
        await flush();

        // 'update' is optional → empty name is fine
        expect($v.$invalid.value).toBe(false);
    });

    it('runs a successful create flow end-to-end', async () => {
        const state = reactive({ name: '', description: '' });
        const $v = useValidup(new RoleValidator(), state, { group: 'create' });
        await flush();

        $v.fields.name.$model.value = 'admin';
        await flush();

        expect($v.fields.name.$invalid.value).toBe(false);
        expect($v.$invalid.value).toBe(false);

        const result = await $v.$validate();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('admin');
        }
    });

    it('subclass instances are independent — separate mounts cache', async () => {
        const a = new RoleValidator();
        const b = new RoleValidator();

        const stateA = reactive({ name: 'admin', description: '' });
        const stateB = reactive({ name: '', description: '' });

        const $vA = useValidup(a, stateA, { group: 'create' });
        const $vB = useValidup(b, stateB, { group: 'create' });
        await flush();

        expect($vA.$invalid.value).toBe(false);
        expect($vB.$invalid.value).toBe(true);
    });
});
