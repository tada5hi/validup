/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    IssueCode,
    ValidupError,
    flattenIssueItems,
    isIssueGroup,
} from '../../src';
import { stringValidator } from '../data';

describe('oneOf', () => {
    it('should work with truthy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({ oneOf: true });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({ foo: 'boz' });

        expect(output.foo).toEqual('boz');
        expect(output.bar).toBeUndefined();
    });

    it('should not work with truthy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({ oneOf: true });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        expect.assertions(1);

        try {
            await container.run({ foo: 1 });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not work falsy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({ oneOf: false });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        expect.assertions(2);

        try {
            await container.run({ foo: 'boz' });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);

                const [issue] = e.issues;
                if (issue.type === 'item') {
                    expect(issue.path).toEqual(['bar']);
                }
            }
        }
    });

    it('should not throw when every branch is filtered out by group', async () => {
        // Regression: oneOf compared errorCount === itemCount unconditionally,
        // so a container whose branches were all filtered out (itemCount === 0)
        // threw ONE_OF_FAILED with an empty issues list.
        const container = new Container<{ foo: string, bar: string }>({ oneOf: true });
        container.mount('foo', { group: 'create' }, stringValidator);
        container.mount('bar', { group: 'create' }, stringValidator);

        const output = await container.run({ foo: 'boz', bar: 'baz' }, { group: 'update' });

        expect(output).toEqual({});
    });

    it('should not throw when every branch is filtered out by pathsToInclude', async () => {
        const container = new Container<{ foo: string, bar: string }>({ oneOf: true });
        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run(
            { foo: 'boz', bar: 'baz' },
            { pathsToInclude: ['qux'] },
        );

        expect(output).toEqual({});
    });

    it('should wrap each failing branch in its own sub-group inside ONE_OF_FAILED', async () => {
        const container = new Container<{ foo: string, bar: string }>({ oneOf: true });
        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        expect.assertions(7);
        try {
            await container.run({ foo: 1, bar: 2 });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);

                const [outer] = e.issues;
                expect(isIssueGroup(outer)).toBe(true);
                if (!isIssueGroup(outer)) return;
                expect(outer.code).toEqual(IssueCode.ONE_OF_FAILED);

                // Two sub-groups, one per branch — per-branch identity preserved.
                expect(outer.issues).toHaveLength(2);
                expect(outer.issues.every(isIssueGroup)).toBe(true);

                const branchNames = outer.issues
                    .filter(isIssueGroup)
                    .map((g) => g.data?.name);
                expect(branchNames).toEqual(['foo', 'bar']);

                // Leaves still flatten to the original two failures.
                const items = flattenIssueItems(e.issues);
                expect(items.map((i) => i.path.join('.')).sort()).toEqual(['bar', 'foo']);
            }
        }
    });
});
