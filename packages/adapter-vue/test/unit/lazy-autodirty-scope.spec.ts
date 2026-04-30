/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { mount } from '@vue/test-utils';
import { 
    describe, 
    expect, 
    it, 
    vi, 
} from 'vitest';
import {
    defineComponent, 
    h, 
    nextTick, 
    reactive,
} from 'vue';
import { Container } from 'validup';
import type { Validator } from 'validup';
import { useValidup } from '../../src';
import type { ValidupComposable } from '../../src';

/* eslint-disable vue/one-component-per-file -- test fixtures defined alongside the spec */

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

describe('options.lazy', () => {
    it('skips the on-mount validation run', async () => {
        const safeRun = vi.fn(async () => ({ success: true, data: {} }) as const);
        const container = { run: vi.fn(), safeRun } as unknown as Container<{ name: string }>;

        const state = reactive({ name: '' });
        useValidup(container, state, { lazy: true });
        await flush();

        expect(safeRun).not.toHaveBeenCalled();
    });

    it('still runs eagerly by default', async () => {
        const safeRun = vi.fn(async () => ({ success: true, data: {} }) as const);
        const container = { run: vi.fn(), safeRun } as unknown as Container<{ name: string }>;

        const state = reactive({ name: '' });
        useValidup(container, state);
        await flush();

        expect(safeRun).toHaveBeenCalled();
    });

    it('triggers validation on the first $model write under lazy', async () => {
        const realContainer = new Container<{ name: string }>();
        realContainer.mount('name', isNonEmptyString);

        // start with a valid value so the on-mount run *would* succeed if it ran
        const state = reactive({ name: 'peter' });
        const $v = useValidup(realContainer, state, { lazy: true });
        await flush();

        expect($v.$invalid.value).toBe(false); // never ran

        // first $model write to a different value triggers the watch
        $v.fields.name.$model.value = '';
        await flush();

        expect($v.$invalid.value).toBe(true); // ran on $model write
    });

    it('runs synchronously when $validate() is called even without prior interaction', async () => {
        const realContainer = new Container<{ name: string }>();
        realContainer.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(realContainer, state, { lazy: true });
        await flush();

        const result = await $v.$validate();
        expect(result.success).toBe(false);
    });
});

describe('options.autoDirty', () => {
    it('marks fields dirty when state changes outside of $model', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state, { autoDirty: true });
        await flush();

        expect($v.fields.name.$dirty.value).toBe(false);

        // Simulate a Pinia store action mutating the form state.
        Object.assign(state, { name: 'peter' });
        await flush();

        expect($v.fields.name.$dirty.value).toBe(true);
    });

    it('does not mark dirty on the initial mount', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state, { autoDirty: true });
        await flush();

        expect($v.fields.name.$dirty.value).toBe(false);
    });

    it('default behaviour (autoDirty unset) leaves hydration silent', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state);
        await flush();

        Object.assign(state, { name: 'peter' });
        await flush();

        expect($v.fields.name.$dirty.value).toBe(false);
    });
});

describe('options.scope', () => {
    const childAContainer = new Container<{ a: string }>();
    childAContainer.mount('a', isNonEmptyString);

    const childBContainer = new Container<{ b: string }>();
    childBContainer.mount('b', isNonEmptyString);

    it('routes children to the matching scoped parent', async () => {
        const ChildA = defineComponent({
            setup(_, { expose }) {
                const form = reactive({ a: '' });
                const $v = useValidup(childAContainer, form, { scope: 'tab1', name: 'a' });
                expose({ $v });
                return () => h('div');
            },
        });

        const ChildB = defineComponent({
            setup(_, { expose }) {
                const form = reactive({ b: '' });
                const $v = useValidup(childBContainer, form, { scope: 'tab2', name: 'b' });
                expose({ $v });
                return () => h('div');
            },
        });

        const Parent = defineComponent({
            setup(_, { expose }) {
                const tab1 = useValidup(new Container(), {}, { scope: 'tab1', stopPropagation: true });
                const tab2 = useValidup(new Container(), {}, { scope: 'tab2', stopPropagation: true });
                expose({ tab1, tab2 });
                return () => h('div', [h(ChildA), h(ChildB)]);
            },
        });

        const wrapper = mount(Parent);
        await flush();

        const { tab1, tab2 } = wrapper.vm as unknown as {
            tab1: ValidupComposable;
            tab2: ValidupComposable;
        };

        expect(tab1.$getResultsForChild('a')).toBeDefined();
        expect(tab1.$getResultsForChild('b')).toBeUndefined();

        expect(tab2.$getResultsForChild('b')).toBeDefined();
        expect(tab2.$getResultsForChild('a')).toBeUndefined();

        wrapper.unmount();
    });

    it('unscoped children attach to the nearest unscoped parent only', async () => {
        const Child = defineComponent({
            setup(_, { expose }) {
                const form = reactive({ a: '' });
                const $v = useValidup(childAContainer, form, { name: 'leaf' });
                expose({ $v });
                return () => h('div');
            },
        });

        const Parent = defineComponent({
            setup(_, { expose }) {
                const scoped = useValidup(new Container(), {}, { scope: 'tab1', stopPropagation: true });
                const unscoped = useValidup(new Container(), {}, { stopPropagation: true });
                expose({ scoped, unscoped });
                return () => h('div', [h(Child)]);
            },
        });

        const wrapper = mount(Parent);
        await flush();

        const { scoped, unscoped } = wrapper.vm as unknown as {
            scoped: ValidupComposable;
            unscoped: ValidupComposable;
        };

        // Child has no scope → only registers with unscoped parent.
        expect(unscoped.$getResultsForChild('leaf')).toBeDefined();
        expect(scoped.$getResultsForChild('leaf')).toBeUndefined();

        wrapper.unmount();
    });
});
