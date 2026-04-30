/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';
import { Container, IssueCode } from 'validup';
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

describe('oneOf group surfacing', () => {
    it('exposes ONE_OF_FAILED group through $groupErrors when any field is dirty', async () => {
        const container = new Container<{ email: string; username: string }>({ oneOf: true });
        container.mount('email', isString);
        container.mount('username', isString);

        const state = reactive({ email: 1 as unknown as string, username: 2 as unknown as string });
        const $v = useValidup(container, state);
        await flush();

        // Internal issue list contains a single ONE_OF_FAILED group — but it's
        // not visible until something is dirty.
        expect($v.$groupErrors.value).toEqual([]);

        $v.fields.email.$touch();
        await flush();

        expect($v.$groupErrors.value).toHaveLength(1);
        expect($v.$groupErrors.value[0]?.code).toBe(IssueCode.ONE_OF_FAILED);
        expect($v.$groupErrors.value[0]?.message).toBe('None of the branches succeeded');
    });

    it('clears the group once any branch succeeds', async () => {
        const container = new Container<{ email: string; username: string }>({ oneOf: true });
        container.mount('email', isString);
        container.mount('username', isString);

        const state = reactive({ email: 1 as unknown as string, username: 2 as unknown as string });
        const $v = useValidup(container, state);
        await flush();
        $v.$touch();
        await flush();
        expect($v.$groupErrors.value).toHaveLength(1);

        // Make one branch succeed.
        $v.fields.email.$model.value = 'peter@example.com';
        await flush();

        expect($v.$groupErrors.value).toEqual([]);
        expect($v.$invalid.value).toBe(false);
    });

    it('exposes leaves nested inside an IssueGroup via fields[<path>].$issues', async () => {
        // Regression for CodeRabbit #5: rawIssuesAtPath only inspected
        // top-level entries, so leaves wrapped inside an IssueGroup (e.g.
        // ONE_OF_FAILED branches) never surfaced through fields.<path>.$issues.
        const container = new Container<{ email: string; username: string }>({ oneOf: true });
        container.mount('email', isString);
        container.mount('username', isString);

        const state = reactive({ email: 1 as unknown as string, username: 2 as unknown as string });
        const $v = useValidup(container, state);
        await flush();

        // The whole-form $issues exposes the wrapping IssueGroup at path [].
        expect($v.$issues.value.length).toBeGreaterThan(0);

        // Per-field $issues: must walk into the group and pull the
        // matching leaf even though the group itself sits at path [].
        const emailIssues = $v.fields.email.$issues.value;
        expect(emailIssues.length).toBeGreaterThan(0);
        // The recursed result wraps matching leaves back inside the group
        // shape so consumers can still distinguish item vs group context.
        expect(emailIssues.some((issue) => issue.type === 'group')).toBe(true);
    });

    it('keeps $errors as leaf-only — group messages live in $groupErrors', async () => {
        const container = new Container<{ email: string; username: string }>({ oneOf: true });
        container.mount('email', isString);
        container.mount('username', isString);

        const state = reactive({ email: 1 as unknown as string, username: 2 as unknown as string });
        const $v = useValidup(container, state);
        await flush();
        $v.$touch();
        await flush();

        // $errors does NOT include the wrapping group message — only the leaves.
        expect($v.$errors.value.some((i) => i.code === IssueCode.ONE_OF_FAILED)).toBe(false);
        expect($v.$errors.value.length).toBeGreaterThan(0);

        // Group message lives in $groupErrors.
        expect($v.$groupErrors.value.some((g) => g.code === IssueCode.ONE_OF_FAILED)).toBe(true);
    });
});
