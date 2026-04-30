/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';
import { Container, defineIssueItem } from 'validup';
import type { Validator } from 'validup';
import { useValidup } from '../../src';

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

describe('external errors', () => {
    it('surfaces path-less issues via $crossCuttingErrors with no dirty gate', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        expect($v.$crossCuttingErrors.value).toEqual([]);

        $v.setExternalIssues([
            defineIssueItem({
                path: [],
                message: 'Rate limit exceeded',
                code: 'rate_limited',
            }),
        ]);
        await flush();

        // No field is dirty — but the cross-cutting error is still visible.
        expect($v.$crossCuttingErrors.value).toHaveLength(1);
        expect($v.$crossCuttingErrors.value[0]?.message).toBe('Rate limit exceeded');
        expect($v.$crossCuttingErrors.value[0]?.meta?.external).toBe(true);
    });

    it('keeps path-less external issues separate from field-level $errors', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        $v.setExternalIssues([
            defineIssueItem({
                path: [], 
                message: 'something went wrong', 
                code: 'unknown', 
            }),
            defineIssueItem({
                path: ['name'], 
                message: 'name conflict', 
                code: 'conflict', 
            }),
        ]);
        $v.fields.name.$touch();
        await flush();

        expect($v.$crossCuttingErrors.value).toHaveLength(1);
        expect($v.$crossCuttingErrors.value[0]?.message).toBe('something went wrong');

        // Field-level $errors only carries the path-attached issue.
        expect($v.fields.name.$errors.value).toHaveLength(1);
        expect($v.fields.name.$errors.value[0]?.message).toBe('name conflict');

        // Whole-form $errors does not include path-less issues.
        expect($v.$errors.value.some((i) => i.message === 'something went wrong')).toBe(false);
    });

    it('clears path-less issues on $reset()', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        $v.setExternalIssues([
            defineIssueItem({
                path: [], 
                message: 'fail', 
                code: 'unknown', 
            }),
        ]);
        await flush();
        expect($v.$crossCuttingErrors.value).toHaveLength(1);

        $v.$reset();
        await flush();
        expect($v.$crossCuttingErrors.value).toEqual([]);
    });

    it('$invalid flips true when only path-less external issues are present', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        expect($v.$invalid.value).toBe(false);

        $v.setExternalIssues([
            defineIssueItem({
                path: [], 
                message: 'rate limit', 
                code: 'rate_limited', 
            }),
        ]);
        await flush();

        expect($v.$invalid.value).toBe(true);
    });
});
