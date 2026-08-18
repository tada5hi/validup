/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    BaseError,
    INSTANCEOF_PROPERTY,
    IssueCode,
    defineIssueGroup,
    flattenIssueItems,
} from '@ebec/core';
import { NotFoundError } from '@ebec/http';
import type { Validator } from '../../src';
import {
    Container,
    VALIDUP_ERROR_INSTANCE,
    ValidupError,
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

    // Regression: @ebec/core@1.3.x gives every BaseError an own `issues`
    // property that defaults to `[]`. `[].every(...)` is vacuously true, so
    // the old duck-type fallback (any own `issues` array whose members all
    // pass `isIssue`) matched every BaseError/HTTPError, not just validup's
    // own errors.
    it('should not misclassify an @ebec/http error as a validup error', () => {
        const error = new NotFoundError();

        expect(isValidupError(error)).toBeFalsy();
    });

    it('should not misclassify a bare @ebec/core BaseError as a validup error', () => {
        const error = new BaseError();

        expect(isValidupError(error)).toBeFalsy();
    });

    it('should verify a real ValidupError carrying issues', () => {
        const error = new ValidupError([
            defineIssueGroup({
                message: 'foo',
                issues: [],
                path: [],
            }),
        ]);

        expect(isValidupError(error)).toBeTruthy();
    });

    // Isolates the marker path from BOTH other branches: a real
    // `new ValidupError()` would already return true via the pre-existing
    // `instanceof ValidupError` fast path, so it can't prove the marker
    // check does anything — the fast path masks a broken/missing marker.
    // This synthetic object is not a `ValidupError` instance (so
    // `instanceof` is false) and carries zero issues (so the duck-typed
    // fallback's `length > 0` requirement rejects it too). Only carrying
    // the marker's serialized `@instanceof` chain — the same string form
    // `ValidupError#toJSON()` emits, simulating a duplicate package copy
    // or a JSON boundary — can make `isValidupError` return true here.
    it('should verify a marker-only error via matchesInstanceof, not instanceof or the duck-typed fallback', () => {
        const markerOnly = {
            name: 'ValidupError',
            message: 'Property foo is invalid',
            issues: [] as unknown[],
            [INSTANCEOF_PROPERTY]: [VALIDUP_ERROR_INSTANCE.description],
        };

        expect(markerOnly instanceof ValidupError).toBe(false);
        expect(markerOnly.issues).toHaveLength(0);
        expect(isValidupError(markerOnly)).toBeTruthy();
    });

    // A JSON round trip loses the `instanceof ValidupError` fast path and
    // drops the symbol form of the `@instanceof` marker (symbols don't
    // survive `JSON.stringify`). Recognizing the rehydrated error therefore
    // requires `matchesInstanceof` (which also matches the marker's
    // serialized description string) rather than `hasInstanceof` (which
    // only matches the native symbol). Using zero issues here rules out the
    // duck-typed fallback silently carrying the assertion instead.
    it('should verify a JSON round-tripped ValidupError via the serialized instanceof chain', () => {
        const error = new ValidupError();
        const rehydrated = JSON.parse(JSON.stringify(error));

        expect(rehydrated instanceof ValidupError).toBe(false);
        expect(isValidupError(rehydrated)).toBeTruthy();
    });

    // Regression: `ValidupError`'s constructor defaults `issues` to `[]`, so
    // a zero-issue ValidupError is a real, reachable case — not just an
    // internal invariant every call site happens to avoid. Before the
    // `@instanceof` marker existed (validup <= 2.0.0), the old duck-typed
    // guard accepted this shape (`instanceof` OR any own `issues` array).
    // Tightening the fallback to `issues.length > 0` dropped it: neither
    // `instanceof` (plain object) nor the marker (absent — this shape
    // predates it, or crossed a boundary that only carries JSON) can catch
    // it, so `code === 'VALIDUP_ERROR'` — the identity signal that DOES
    // survive serialization — must carry the fallback here instead.
    it('should verify a marker-less, zero-issue error that self-identifies via code VALIDUP_ERROR', () => {
        const legacyShaped = {
            name: 'ValidupError',
            message: 'Properties are invalid',
            code: 'VALIDUP_ERROR',
            issues: [] as unknown[],
        };

        expect(legacyShaped instanceof ValidupError).toBe(false);
        expect(isValidupError(legacyShaped)).toBeTruthy();
    });

    // The code check must discriminate, not just widen the fallback back to
    // "any empty issues array qualifies" (which would resurrect the
    // original bug). A foreign `code` on a zero-issue, marker-less object
    // must still be rejected.
    it('should not verify a marker-less, zero-issue error carrying a foreign code', () => {
        const foreignShaped = {
            name: 'NotFoundError',
            message: 'Not Found',
            code: 'NOT_FOUND',
            issues: [] as unknown[],
        };

        expect(isValidupError(foreignShaped)).toBeFalsy();
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

    it('should synthesize a fallback IssueItem when a validator throws a string', async () => {
        const stringThrowing: Validator = () => {
            // eslint-disable-next-line no-throw-literal
            throw 'pure string failure';
        };
        const container = new Container<{ foo: string }>();
        container.mount('foo', stringThrowing);

        expect.assertions(3);
        try {
            await container.run({ foo: 'x' });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                expect(items).toHaveLength(1);
                expect(items[0].path).toEqual(['foo']);
                expect(items[0].message).toEqual('pure string failure');
            }
        }
    });

    it('should synthesize a fallback IssueItem when a validator throws a non-Error object', async () => {
        const objectThrowing: Validator = () => {
            // eslint-disable-next-line no-throw-literal
            throw { not: 'an error' };
        };
        const container = new Container<{ foo: string }>();
        container.mount('foo', objectThrowing);

        expect.assertions(2);
        try {
            await container.run({ foo: 'x' });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                expect(items).toHaveLength(1);
                // Non-Error throws surface with a synthetic prefix so the
                // diagnostic is at least traceable in logs.
                expect(items[0].message.startsWith('Non-Error throw:')).toBe(true);
            }
        }
    });

    it('should record non-Error throws under the mounted path via safeRun', async () => {
        const stringThrowing: Validator = () => {
            // eslint-disable-next-line no-throw-literal
            throw 'safeRun caught me';
        };
        const container = new Container<{ foo: string }>();
        container.mount('foo', stringThrowing);

        const result = await container.safeRun({ foo: 'x' });
        expect(result.success).toBe(false);
        if (!result.success) {
            // A non-Error throw inside a mount goes through the sequential
            // `run()` path, which folds it via recordMountError — so it ends
            // up attached to the mount's path (`['foo']`), not as a path-less
            // synthetic. (`wrapSafeRunError`'s path-less synthesis is reserved
            // for throws that bypass the mount catch entirely — e.g. a buggy
            // `IContainer` implementation breaking `safeRun`'s contract.)
            const items = flattenIssueItems(result.error.issues);
            expect(items).toHaveLength(1);
            expect(items[0].path).toEqual(['foo']);
            expect(items[0].message).toEqual('safeRun caught me');
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
