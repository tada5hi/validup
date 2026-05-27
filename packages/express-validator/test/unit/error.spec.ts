/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { body, oneOf } from 'express-validator';
import {
    Container,
    IssueCode,
    ValidupError,
    flattenIssueItems,
    isIssueGroup,
} from 'validup';
import { createValidator } from '../../src';

describe('error translation', () => {
    it('should split dotted/bracketed field paths into PropertyKey[]', async () => {
        // Regression: error.ts previously emitted `path: [error.path]`, leaving
        // dotted strings unsplit. Per Issue.path's contract, segments are
        // separate elements (numeric for bracket indices).
        const container = new Container();
        container.mount('user', createValidator(() => body('user.address.city').isString()));

        expect.assertions(2);
        try {
            await container.run({ user: { address: { city: 42 } } });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                expect(items).toHaveLength(1);
                // Parent prefix 'user' from the mount + split chain path.
                expect(items[0].path).toEqual(['user', 'user', 'address', 'city']);
            }
        }
    });

    it('should split bracketed numeric indices into numbers', async () => {
        const container = new Container();
        container.mount('list', createValidator(() => body('items[0].name').isString()));

        expect.assertions(1);
        try {
            await container.run({ list: { items: [{ name: 1 }] } });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                // The '0' segment is a number, not the string '0'.
                expect(items[0].path).toEqual(['list', 'items', 0, 'name']);
            }
        }
    });

    it('should not drop errors past the first selected field', async () => {
        // Regression: the adapter previously read `const [field] = getData()`
        // and matched errors against that single field, silently dropping
        // every other field's validation outcome.
        const container = new Container();
        container.mount(
            'group',
            createValidator(() => body(['a', 'b']).isString()),
        );

        expect.assertions(2);
        try {
            await container.run({ group: { a: 1, b: 2 } });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                // Both fields surface, not just one.
                const paths = items.map((i) => i.path.join('.')).sort();
                expect(paths.length).toBeGreaterThanOrEqual(2);
                expect(paths.some((p) => p.endsWith('.a')) &&
                    paths.some((p) => p.endsWith('.b'))).toBe(true);
            }
        }
    });

    it('should wrap alternative errors in an IssueGroup with ONE_OF_FAILED', async () => {
        // Regression: `alternative` / `alternative_grouped` were filtered out
        // entirely by the `error.type === 'field'` check. Now they surface as
        // an IssueGroup so consumers can distinguish a oneOf failure from a
        // flat list of independent field errors.
        const container = new Container();
        container.mount('val', createValidator(() => oneOf([
            body('val').isString(),
            body('val').isInt(),
        ])));

        expect.assertions(2);
        try {
            await container.run({ val: { not: 'either' } });
        } catch (e) {
            if (e instanceof ValidupError) {
                // The mount path is 'val', so recordMountError wraps the
                // adapter's IssueGroup into another group keyed by 'val'.
                // Either way, somewhere in the tree there is a group carrying
                // ONE_OF_FAILED.
                const stack = [...e.issues];
                let foundOneOf = false;
                let foundLeafError = false;
                while (stack.length > 0) {
                    const issue = stack.pop()!;
                    if (isIssueGroup(issue)) {
                        if (issue.code === IssueCode.ONE_OF_FAILED) {
                            foundOneOf = true;
                        }
                        stack.push(...issue.issues);
                    } else {
                        foundLeafError = true;
                    }
                }
                expect(foundOneOf).toBe(true);
                expect(foundLeafError).toBe(true);
            }
        }
    });

    it('should return the sanitized value when a single-field chain succeeds', async () => {
        // express-validator mutates `FieldInstance.value` as sanitizers run
        // (see Context.setData). The adapter forwards that post-sanitizer
        // value upstream when the chain selects a single field.
        const container = new Container<{ name: string }>();
        // body() with no arg selects the root, so the chain operates on the
        // string value validup mounted at 'name'.
        container.mount('name', createValidator(() => body().trim()));

        const outcome = await container.run({ name: '  Peter  ' });
        expect(outcome.name).toEqual('Peter');
    });

    describe('structured msg → vocabulary code mapping', () => {
        // express-validator doesn't preserve the failing validator's identity
        // through ValidationError, so the adapter can't auto-derive a code.
        // The opt-in path: pass `{ code, message }` to .withMessage() — the
        // adapter detects the structured shape and lifts both onto IssueItem.

        it('lifts a structured { code, message } payload from .withMessage onto IssueItem', async () => {
            const container = new Container<{ email: string }>();
            container.mount('email', createValidator(() => body()
                .isEmail()
                .withMessage({ code: IssueCode.EMAIL, message: 'Invalid email' })));

            expect.assertions(3);
            try {
                await container.run({ email: 'not-an-email' });
            } catch (e) {
                if (e instanceof ValidupError) {
                    const items = flattenIssueItems(e.issues);
                    expect(items).toHaveLength(1);
                    expect(items[0]?.code).toBe(IssueCode.EMAIL);
                    expect(items[0]?.message).toBe('Invalid email');
                }
            }
        });

        it('falls back to VALUE_INVALID when .withMessage receives a plain string', async () => {
            // Backward compatibility: the pre-vocabulary shape (plain string
            // message) still works and defaults to VALUE_INVALID.
            const container = new Container<{ name: string }>();
            container.mount('name', createValidator(() => body()
                .isLength({ min: 3 })
                .withMessage('Name too short')));

            expect.assertions(2);
            try {
                await container.run({ name: 'a' });
            } catch (e) {
                if (e instanceof ValidupError) {
                    const items = flattenIssueItems(e.issues);
                    expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
                    expect(items[0]?.message).toBe('Name too short');
                }
            }
        });

        it('falls back to VALUE_INVALID for a partial payload missing `message`', async () => {
            // Guard against accidental shapes like `{ code: 'x' }` without a
            // `message` — silently dropping these would surface the cryptic
            // `[object Object]` string. Treat them as plain-message instead.
            const container = new Container<{ name: string }>();
            container.mount('name', createValidator(() => body()
                .isLength({ min: 3 })
                .withMessage({ code: 'something' } as never)));

            expect.assertions(1);
            try {
                await container.run({ name: 'a' });
            } catch (e) {
                if (e instanceof ValidupError) {
                    const items = flattenIssueItems(e.issues);
                    expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
                }
            }
        });
    });
});
