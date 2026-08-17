/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { Container, ValidupError } from '../../src';
import { stringValidator } from '../data';

// `formatIssue` / `interpolate` themselves live in `@ebec/core` and are
// covered by its own tests. What remains validup's to test is the `data`
// the RUNTIME attaches — the payload a consumer-side template renders against.

describe('Issue.data populated by the runtime', () => {
    it('should set data: { name } on the wrapping IssueGroup of a failing mount', async () => {
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
                    expect(group.data).toEqual({ name: 'profile' });
                }
            }
        }
    });
});
