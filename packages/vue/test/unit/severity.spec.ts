/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import {
    defineComponent,
    nextTick,
    reactive,
    ref,
} from 'vue';
import { Container } from 'validup';
import type { IssueItem, Validator } from 'validup';
import { getSeverity, useValidup } from '../../src';
import type { Composable, FieldState } from '../../src';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
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

/**
 * Minimal `FieldState` shim — only the fields `getSeverity` actually reads
 * are populated. Lets each case state exactly what it cares about without
 * spinning up a Vue component + Container per assertion.
 *
 * The shim simulates the post-filter state — i.e. the items the host
 * `FieldState.$errors` would already have surfaced. In real usage,
 * optional-mount items are stripped from `$errors` pre-touch by
 * `isIssueItemVisible`, so passing them here pre-touch represents a
 * defensive call site (the helper still does the right thing).
 */
function buildFieldState(opts: {
    dirty: boolean;
    pending?: boolean;
    invalid?: boolean;
    errors?: IssueItem[];
}): FieldState<unknown> {
    return {
        $dirty: ref(opts.dirty),
        $pending: ref(opts.pending ?? false),
        $invalid: ref(opts.invalid ?? false),
        $errors: ref(opts.errors ?? []),
    } as unknown as FieldState<unknown>;
}

describe('getSeverity', () => {
    it('returns undefined while the field is not dirty and has no visible errors', () => {
        expect(getSeverity(buildFieldState({ dirty: false }))).toBeUndefined();
    });

    it('returns warning when not dirty and a required-mount error is visible', () => {
        // Required-mount items are NOT filtered from `$errors` pre-touch,
        // so this mirrors the real `FieldState.$errors` shape on initial load.
        const errors: IssueItem[] = [
            {
                type: 'item',
                code: 'REQUIRED',
                path: ['email'],
                message: 'Email is required',
            } as IssueItem,
        ];
        expect(getSeverity(buildFieldState({
            dirty: false,
            invalid: true,
            errors,
        }))).toBe('warning');
    });

    it('returns undefined when not dirty even if optional-mount items somehow leaked into $errors', () => {
        // Defensive: in real usage `isIssueItemVisible` strips optional items
        // from `$errors` pre-touch, so this state shouldn't occur — but if a
        // consumer wires a custom field-state, severity must still degrade
        // gracefully.
        const errors: IssueItem[] = [
            {
                type: 'item',
                code: 'MIN_LENGTH',
                path: ['bio'],
                message: 'too short',
                meta: { optional: true },
            } as IssueItem,
        ];
        expect(getSeverity(buildFieldState({
            dirty: false,
            invalid: true,
            errors,
        }))).toBeUndefined();
    });

    it('returns success when dirty and valid', () => {
        expect(getSeverity(buildFieldState({ dirty: true }))).toBe('success');
    });

    it('returns warning while validation is pending', () => {
        expect(getSeverity(buildFieldState({ dirty: true, pending: true }))).toBe('warning');
    });

    it('returns error when invalid and at least one issue is from a required mount', () => {
        const errors = [
            {
                type: 'item', 
                code: 'X', 
                path: ['x'], 
                message: 'x', 
            } as IssueItem,
        ];
        expect(getSeverity(buildFieldState({
            dirty: true, 
            invalid: true, 
            errors,
        }))).toBe('error');
    });

    it('returns warning when invalid and all issues are from optional mounts', () => {
        const errors = [
            {
                type: 'item', 
                code: 'X', 
                path: ['x'], 
                message: 'x', 
                meta: { optional: true },
            } as IssueItem,
            {
                type: 'item', 
                code: 'Y', 
                path: ['x'], 
                message: 'y', 
                meta: { optional: true },
            } as IssueItem,
        ];
        expect(getSeverity(buildFieldState({
            dirty: true, 
            invalid: true, 
            errors,
        }))).toBe('warning');
    });

    it('returns error when invalid and issues are mixed required + optional', () => {
        const errors = [
            {
                type: 'item', 
                code: 'OPT', 
                path: ['x'], 
                message: 'opt', 
                meta: { optional: true },
            } as IssueItem,
            {
                type: 'item', 
                code: 'REQ', 
                path: ['x'], 
                message: 'req', 
            } as IssueItem,
        ];
        expect(getSeverity(buildFieldState({
            dirty: true, 
            invalid: true, 
            errors,
        }))).toBe('error');
    });

    it('integrates end-to-end: optional mount surfaces as warning, required as error', async () => {
        const container = new Container<{ required: string; optional: string }>();
        container.mount('required', isString);
        container.mount('optional', { optional: true }, isString);

        const Form = defineComponent({
            setup() {
                const state = reactive({ required: 1 as unknown as string, optional: 2 as unknown as string });
                const $v = useValidup(container, state);
                return { $v };
            },
            template: '<div />',
        });

        const wrapper = mount(Form);
        await flush();
        const { $v } = wrapper.vm as unknown as { $v: Composable };

        // Pristine — required field surfaces as warning so the consumer
        // knows the form isn't valid yet; the optional field with an
        // optional-tagged issue stays silent.
        expect(getSeverity($v.fields.required)).toBe('warning');
        expect(getSeverity($v.fields.optional)).toBeUndefined();

        $v.fields.required.$touch();
        $v.fields.optional.$touch();
        await flush();

        // After touching: the required field has no meta.optional on its
        // issues → error; the optional field's issues are all tagged with
        // meta.optional → warning.
        expect(getSeverity($v.fields.required)).toBe('error');
        expect(getSeverity($v.fields.optional)).toBe('warning');

        wrapper.unmount();
    });
});
