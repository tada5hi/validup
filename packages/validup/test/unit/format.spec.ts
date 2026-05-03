/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    IssueCode,
    ValidupError,
    defineIssueGroup,
    defineIssueItem,
    formatIssue,
    interpolate,
} from '../../src';
import { stringValidator } from '../data';

describe('formatIssue', () => {
    it('should fall back to issue.message when no templates are provided', () => {
        const issue = defineIssueItem({ path: ['x'], message: 'invalid' });
        expect(formatIssue(issue)).toEqual('invalid');
    });

    it('should interpolate a matching template using params', () => {
        const issue = defineIssueItem({
            code: IssueCode.VALUE_INVALID,
            path: ['email'],
            message: 'Value invalid',
            params: { name: 'email' },
        });

        const out = formatIssue(issue, { value_invalid: 'Field {name} is invalid' });

        expect(out).toEqual('Field email is invalid');
    });

    it('should fall back to message when no template matches the code', () => {
        const issue = defineIssueItem({
            code: 'unknown_code',
            path: [],
            message: 'literal',
        });

        expect(formatIssue(issue, { value_invalid: 'X' })).toEqual('literal');
    });

    it('should return the fallback when neither template nor message is set', () => {
        const issue = defineIssueGroup({
            path: [],
            message: '',
            issues: [],
        });

        expect(formatIssue(issue, undefined, '—')).toEqual('—');
    });

    it('should re-export ebec interpolate', () => {
        expect(interpolate('hello {who}', { who: 'world' })).toEqual('hello world');
    });
});

describe('Issue.params populated by the runtime', () => {
    it('should set params: { name } on the wrapping IssueGroup of a failing mount', async () => {
        const child = new Container<{ inner: string }>();
        child.mount('inner', stringValidator);

        const parent = new Container<{ profile: { inner: string } }>();
        parent.mount('profile', child);

        try {
            await parent.run({ profile: { inner: 42 } });
            expect.fail('expected ValidupError');
        } catch (e) {
            if (e instanceof ValidupError) {
                const [group] = e.issues;
                expect(group?.type).toEqual('group');
                if (group?.type === 'group') {
                    expect(group.params).toEqual({ name: 'profile' });
                }
            }
        }
    });
});
