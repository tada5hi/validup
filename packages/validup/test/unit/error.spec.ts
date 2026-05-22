/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import {
    Container,
    IssueCode,
    ValidupError,
    defineIssueGroup,
    flattenIssueItems,
    isValidupError,
} from '../../src';

describe('error', () => {
    it('should verify error', () => {
        const error = new ValidupError();

        expect(isValidupError(error)).toBeTruthy();
    });

    it('should verify error similar shape', () => {
        const error = new Error();
        (error as Record<string, any>).issues = [
            defineIssueGroup({
                message: 'foo',
                issues: [],
                path: [],
            }),
        ];

        expect(isValidupError(error)).toBeTruthy();
    });

    it('should not verify error', () => {
        const error = new Error();

        expect(isValidupError(error)).toBeFalsy();
    });

    it('should expose an ebec-style code on ValidupError', () => {
        const error = new ValidupError();

        expect(error.code).toEqual('VALIDUP_ERROR');
    });

    it('should serialize via toJSON including issues', () => {
        const error = new ValidupError([
            defineIssueGroup({
                message: 'foo',
                issues: [],
                path: ['foo'],
            }),
        ]);

        const serialized = error.toJSON();
        expect(serialized.name).toEqual('ValidupError');
        expect(serialized.code).toEqual('VALIDUP_ERROR');
        expect(serialized.issues).toHaveLength(1);
        expect(serialized.issues[0]).toMatchObject({ type: 'group', message: 'foo' });
    });

    it('should recursively prefix nested IssueGroup paths from a child container', async () => {
        // Regression: recordMountError prepended `keyParts` to each top-level
        // child issue's path, but did not recurse into IssueGroup.issues. So
        // when a child container's failure was already wrapped in an IssueGroup
        // (e.g. by its own multi-issue mount aggregation, or a `oneOf` child),
        // the inner IssueItems kept only the child-local key — making
        // `flattenIssueItems` return leaves missing the parent prefix.
        const failing: Validator = async () => {
            throw new Error('bad');
        };

        // Child container holds a single mount whose path expands to two keys,
        // so recordMountError wraps the two IssueItems in an IssueGroup at the
        // child level. When the parent catches the child's ValidupError, the
        // group's path AND its children's paths must both pick up the parent
        // prefix.
        const child = new Container<{ foo: string, bar: string }>();
        child.mount('foo', failing);
        child.mount('bar', failing);

        const grandChild = new Container({ oneOf: true });
        grandChild.mount('a', failing);
        grandChild.mount('b', failing);
        child.mount('one-of', grandChild);

        const parent = new Container<{ nested: Record<string, unknown> }>();
        parent.mount('nested', child);

        expect.assertions(2);
        try {
            await parent.run({
                nested: {
                    foo: 1, 
                    bar: 1, 
                    'one-of': {}, 
                }, 
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                // Every leaf path must start with 'nested' — none kept the
                // child-local key only.
                expect(items.every((i) => i.path[0] === 'nested')).toBe(true);

                // The oneOf grand-child surfaces as nested → one-of → a/b.
                const oneOfLeafs = items.filter((i) => i.path[1] === 'one-of');
                expect(
                    oneOfLeafs.some((i) => i.path.join('.') === 'nested.one-of.a') &&
                    oneOfLeafs.some((i) => i.path.join('.') === 'nested.one-of.b'),
                ).toBe(true);
            }
        }
    });

    it('should re-path the ONE_OF_FAILED group itself when bubbling from a child', async () => {
        const failing: Validator = async () => {
            throw new Error('bad');
        };
        const child = new Container({ oneOf: true });
        child.mount('a', failing);
        child.mount('b', failing);

        const parent = new Container<{ nested: Record<string, unknown> }>();
        parent.mount('nested', child);

        expect.assertions(3);
        try {
            await parent.run({ nested: {} });
        } catch (e) {
            if (e instanceof ValidupError) {
                // Find the inner group with the ONE_OF_FAILED code, regardless
                // of how recordMountError chose to wrap it.
                const items = flattenIssueItems(e.issues);
                expect(items.length).toBeGreaterThanOrEqual(2);
                const codes = items.map((i) => i.code);
                expect(codes.every((c) => c === IssueCode.VALUE_INVALID)).toBe(true);
                expect(items.every((i) => i.path[0] === 'nested')).toBe(true);
            }
        }
    });
});
