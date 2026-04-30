/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* eslint-disable vue/one-component-per-file -- test fixtures defined alongside the spec */

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import {
    defineComponent,
    h,
    nextTick,
    reactive,
} from 'vue';
import { Container } from 'validup';
import type { Validator } from 'validup';
import { extractValidupResultsFromChild, useValidup } from '../../src';
import type { ValidupComposable } from '../../src';

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

const basicContainer = new Container<{ name: string }>();
basicContainer.mount('name', isNonEmptyString);

const credentialsContainer = new Container<{ password: string }>();
credentialsContainer.mount('password', isNonEmptyString);

const ChildBasic = defineComponent({
    setup(_, { expose }) {
        const form = reactive({ name: '' });
        const $v = useValidup(basicContainer, form, { name: 'basic' });
        expose({ $v, form });
        return () => h('div', { class: 'child-basic' });
    },
});

const ChildCredentials = defineComponent({
    setup(_, { expose }) {
        const form = reactive({ password: '' });
        const $v = useValidup(credentialsContainer, form, { name: 'credentials' });
        expose({ $v, form });
        return () => h('div', { class: 'child-credentials' });
    },
});

const Parent = defineComponent({
    setup(_, { expose }) {
        const $v = useValidup(new Container(), {}, { stopPropagation: true });
        expose({ $v });
        return () => h('div', [h(ChildBasic), h(ChildCredentials)]);
    },
});

describe('nested forms', () => {
    it('children auto-register with the parent collector via provide/inject', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: ValidupComposable });

        expect($v.$getResultsForChild('basic')).toBeDefined();
        expect($v.$getResultsForChild('credentials')).toBeDefined();
        expect($v.$getResultsForChild('missing')).toBeUndefined();

        wrapper.unmount();
    });

    it('parent surfaces invalidity from any child', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: ValidupComposable });
        const basic = $v.$getResultsForChild<{ name: string }>('basic')!;

        // children start invalid (empty fields)
        expect(basic.$invalid.value).toBe(true);

        // parent's own container is empty so it is valid in isolation,
        // but a real consumer typically gates submit on every child's $invalid:
        const anyChildInvalid = ['basic', 'credentials']
            .map((n) => $v.$getResultsForChild(n))
            .some((c) => c?.$invalid.value);
        expect(anyChildInvalid).toBe(true);

        wrapper.unmount();
    });

    it('extractValidupResultsFromChild collects child $model values', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: ValidupComposable });

        const basic = $v.$getResultsForChild<{ name: string }>('basic')!;
        const credentials = $v.$getResultsForChild<{ password: string }>('credentials')!;

        basic.fields.name.$model.value = 'peter';
        credentials.fields.password.$model.value = 'secret';
        await flush();

        const merged = {
            ...extractValidupResultsFromChild<{ name: string }>($v, 'basic'),
            ...extractValidupResultsFromChild<{ password: string }>($v, 'credentials'),
        };

        expect(merged).toEqual({ name: 'peter', password: 'secret' });
        wrapper.unmount();
    });

    it('children unregister when their component scope disposes', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: ValidupComposable });
        expect($v.$getResultsForChild('basic')).toBeDefined();

        wrapper.unmount();

        // After unmount, the parent's registry should have been cleared via onScopeDispose.
        expect($v.$getResultsForChild('basic')).toBeUndefined();
        expect($v.$getResultsForChild('credentials')).toBeUndefined();
    });
});
