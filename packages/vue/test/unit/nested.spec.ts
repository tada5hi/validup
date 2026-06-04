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
    computed,
    defineComponent,
    h,
    isRef,
    nextTick,
    reactive,
    ref,
} from 'vue';
import { Container } from 'validup';
import type { Validator } from 'validup';
import { extractResultsFromChild, useValidup } from '../../src';
import type { Composable } from '../../src';

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

        const { $v } = (wrapper.vm as unknown as { $v: Composable });

        expect($v.$getResultsForChild('basic')).toBeDefined();
        expect($v.$getResultsForChild('credentials')).toBeDefined();
        expect($v.$getResultsForChild('missing')).toBeUndefined();

        wrapper.unmount();
    });

    it('parent surfaces invalidity from any child', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: Composable });
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

    it('extractResultsFromChild collects child $model values', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: Composable });

        const basic = $v.$getResultsForChild<{ name: string }>('basic')!;
        const credentials = $v.$getResultsForChild<{ password: string }>('credentials')!;

        basic.fields.name.$model.value = 'peter';
        credentials.fields.password.$model.value = 'secret';
        await flush();

        const merged = {
            ...extractResultsFromChild<{ name: string }>($v, 'basic'),
            ...extractResultsFromChild<{ password: string }>($v, 'credentials'),
        };

        expect(merged).toEqual({ name: 'peter', password: 'secret' });
        wrapper.unmount();
    });

    it('children unregister when their component scope disposes', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: Composable });
        expect($v.$getResultsForChild('basic')).toBeDefined();

        wrapper.unmount();

        // After unmount, the parent's registry should have been cleared via onScopeDispose.
        expect($v.$getResultsForChild('basic')).toBeUndefined();
        expect($v.$getResultsForChild('credentials')).toBeUndefined();
    });
});

describe('child registry reactivity', () => {
    // Parent that consumes the registry REACTIVELY: a computed primed before
    // any child has registered, plus a template binding that walks
    // registry → child → $invalid. Both only work because the registry is
    // `shallowReactive` — a plain Map would cache the initial miss forever.
    const AggregatingParent = defineComponent({
        setup(_, { expose }) {
            const show = ref(true);
            const $v = useValidup(new Container(), {}, { stopPropagation: true });

            const basic = computed(() => $v.$getResultsForChild<{ name: string }>('basic'));
            // Prime the computed BEFORE the child's setup has run — with a
            // non-reactive registry this miss would be cached forever.
            const initial = basic.value;

            const hide = () => {
                show.value = false;
            };

            expose({
                $v, 
                initial, 
                hide,
            });
            return () => h('div', [
                show.value ? h(ChildBasic) : null,
                h('span', { class: 'agg' }, basic.value ?
                    String(basic.value.$invalid.value) :
                    'unregistered'),
            ]);
        },
    });

    it('a computed over $getResultsForChild re-evaluates when the child registers', async () => {
        const wrapper = mount(AggregatingParent);
        await flush();

        const vm = wrapper.vm as unknown as { $v: Composable, initial: unknown };

        // setup-time lookup ran before the child registered …
        expect(vm.initial).toBeUndefined();
        // … but the same computed now resolves the child (registry tracked).
        expect(wrapper.find('.agg').text()).toBe('true');

        wrapper.unmount();
    });

    it('parent template tracks a child\'s $invalid through the registry', async () => {
        const wrapper = mount(AggregatingParent);
        await flush();

        const vm = wrapper.vm as unknown as { $v: Composable, hide: () => void };

        const child = vm.$v.$getResultsForChild<{ name: string }>('basic')!;
        child.fields.name.$model.value = 'peter';
        await flush();

        expect(wrapper.find('.agg').text()).toBe('false');

        // Removing the child unregisters it — the registry lookup reactively
        // flips back to the miss branch.
        vm.hide();
        await flush();
        expect(wrapper.find('.agg').text()).toBe('unregistered');

        wrapper.unmount();
    });

    it('registry lookups return the child composable raw — nested refs are not unwrapped', async () => {
        const wrapper = mount(Parent);
        await flush();

        const { $v } = (wrapper.vm as unknown as { $v: Composable });
        const child = $v.$getResultsForChild('basic')!;

        // `shallowReactive` returns stored values verbatim; a deep `reactive`
        // wrapper would unwrap these refs and break the public type.
        expect(isRef(child.$invalid)).toBe(true);
        expect(isRef(child.$dirty)).toBe(true);
        expect(isRef(child.$errors)).toBe(true);

        wrapper.unmount();
    });
});
