/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* eslint-disable vue/one-component-per-file -- test fixtures defined alongside the spec */

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
    ref,
} from 'vue';
import { Container, ValidupError, defineIssueItem } from 'validup';
import type { Validator } from 'validup';
import { useValidup } from '../../src';
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

describe('state passed as Ref<T> (T1)', () => {
    it('reads and writes through the wrapping ref', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = ref({ name: '' });
        const $v = useValidup(container, state);
        await flush();

        // initial run flagged the empty value invalid
        expect($v.$invalid.value).toBe(true);

        // $model writes go through the wrapping ref
        $v.fields.name.$model.value = 'peter';
        await flush();
        expect(state.value.name).toBe('peter');
        expect($v.$invalid.value).toBe(false);
    });

    it('replacing the wrapped state object re-runs validation', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = ref<{ name: string }>({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();
        expect($v.$invalid.value).toBe(false);

        // wholesale replacement triggers the deep watcher
        state.value = { name: '' };
        await flush();
        expect($v.$invalid.value).toBe(true);
    });
});

describe('$reset preserves internalIssues (T2)', () => {
    it('keeps $invalid true after $reset() because state is still bad', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: '' });
        const $v = useValidup(container, state);
        await flush();

        $v.$touch();
        await flush();
        expect($v.$invalid.value).toBe(true);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);

        $v.$reset();
        await flush();

        // dirty cleared → field-level $errors hidden again
        expect($v.fields.name.$dirty.value).toBe(false);
        expect($v.fields.name.$errors.value).toEqual([]);
        // …but internal invalidity is preserved (it's a property of state)
        expect($v.$invalid.value).toBe(true);
    });
});

describe('$model write triggers validation + autoDirty (T3)', () => {
    it('autoDirty does not double-mark when $model already did', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isNonEmptyString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state, { autoDirty: true });
        await flush();
        expect($v.fields.name.$dirty.value).toBe(false);

        // $model write triggers both:
        //   - the schedule() validation watcher
        //   - the autoDirty watcher
        // Net effect: field is dirty, validation re-ran, no double-counting.
        $v.fields.name.$model.value = '';
        await flush();

        expect($v.fields.name.$dirty.value).toBe(true);
        expect($v.fields.name.$errors.value.length).toBeGreaterThan(0);
    });
});

describe('$pending lifecycle through slow async validator (T4)', () => {
    it('flips true during the run and false on resolution', async () => {
        let release: (() => void) | undefined;
        const slow: Validator = () => new Promise<string>((resolve) => {
            release = () => resolve('ok');
        });

        const container = new Container<{ name: string }>();
        container.mount('name', slow);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        // do not flush — kick the run, then sample $pending mid-flight
        await nextTick();

        expect($v.$pending.value).toBe(true);
        expect($v.fields.name.$pending.value).toBe(true);

        release!();
        await flush();

        expect($v.$pending.value).toBe(false);
        expect($v.fields.name.$pending.value).toBe(false);
    });
});

describe('detached vs stopPropagation (F1)', () => {
    it('detached parent: descendants do NOT see it as a parent', async () => {
        const childContainer = new Container<{ name: string }>();
        childContainer.mount('name', isNonEmptyString);

        const Child = defineComponent({
            setup(_, { expose }) {
                const form = reactive({ name: '' });
                const $v = useValidup(childContainer, form, { name: 'leaf' });
                expose({ $v });
                return () => h('div');
            },
        });

        const Parent = defineComponent({
            setup(_, { expose }) {
                // detached → no provide() → child cannot register here
                const $v = useValidup(new Container(), {}, { detached: true });
                expose({ $v });
                return () => h('div', [h(Child)]);
            },
        });

        const wrapper = mount(Parent);
        await flush();

        const { $v } = wrapper.vm as unknown as { $v: ValidupComposable };
        expect($v.$getResultsForChild('leaf')).toBeUndefined();

        wrapper.unmount();
    });

    it('stopPropagation parent: descendants register, parent itself stays unattached', async () => {
        const childContainer = new Container<{ name: string }>();
        childContainer.mount('name', isNonEmptyString);

        const Child = defineComponent({
            setup(_, { expose }) {
                const form = reactive({ name: '' });
                const $v = useValidup(childContainer, form, { name: 'leaf' });
                expose({ $v });
                return () => h('div');
            },
        });

        // Outer collector — would otherwise pick up `inner`.
        const Outer = defineComponent({
            setup(_, { expose }) {
                const $v = useValidup(new Container(), {}, { stopPropagation: true });
                expose({ $v });
                return () => h(Inner);
            },
        });

        // Middle composable with stopPropagation: doesn't attach to outer,
        // but children still attach to it.
        const Inner = defineComponent({
            setup(_, { expose }) {
                const $v = useValidup(new Container(), {}, {
                    name: 'inner',
                    stopPropagation: true,
                });
                expose({ $v });
                return () => h('div', [h(Child)]);
            },
        });

        const wrapper = mount(Outer);
        await flush();

        const outer = (wrapper.vm as unknown as { $v: ValidupComposable }).$v;
        // Outer doesn't see Inner because Inner stopPropagation'd.
        expect(outer.$getResultsForChild('inner')).toBeUndefined();

        wrapper.unmount();
    });
});

describe('runOnce defensive guard (F2)', () => {
    it('surfaces a thrown error from a buggy IContainer as a synthetic Result failure', async () => {
        const container = {
            run: vi.fn(),
            safeRun: vi.fn(async () => {
                throw new Error('boom from a broken container');
            }),
        } as unknown as Container<{ name: string }>;

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        expect($v.$invalid.value).toBe(true);
        // The synthetic failure carries a path-less issue → surfaces in
        // $crossCuttingErrors with the original message.
        expect($v.$crossCuttingErrors.value).toHaveLength(1);
        expect($v.$crossCuttingErrors.value[0]?.message).toBe('boom from a broken container');
    });

    it('preserves a thrown ValidupError verbatim', async () => {
        const customIssues = [
            defineIssueItem({
                path: ['name'],
                code: 'custom_failure',
                message: 'name is reserved',
            }),
        ];
        const container = {
            run: vi.fn(),
            safeRun: vi.fn(async () => {
                throw new ValidupError(customIssues);
            }),
        } as unknown as Container<{ name: string }>;

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const result = await $v.$validate();
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(customIssues);
        }
    });
});

describe('$crossCuttingErrors surfaces internal path-less issues (F4)', () => {
    it('routes container-level path-less issues into $crossCuttingErrors', async () => {
        const container = {
            run: vi.fn(),
            safeRun: vi.fn(async () => ({
                success: false,
                error: new ValidupError([
                    defineIssueItem({
                        path: [],
                        code: 'schema_mismatch',
                        message: 'state shape does not match schema',
                    }),
                ]),
            } as const)),
        } as unknown as Container<{ name: string }>;

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        expect($v.$crossCuttingErrors.value).toHaveLength(1);
        expect($v.$crossCuttingErrors.value[0]?.message).toBe('state shape does not match schema');
        // No external tagging — this issue came from the run, not setExternalIssues.
        expect($v.$crossCuttingErrors.value[0]?.meta?.external).toBeUndefined();
    });
});
