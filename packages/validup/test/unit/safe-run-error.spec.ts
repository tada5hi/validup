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
    defineIssueItem,
    isIssueItem,
} from '../../src';
import { PathsStrictViolationError } from '../../src/container/paths-strict-violation';
import { stringValidatorSync } from '../data';

/**
 * `wrapSafeRunError` is the fold `safeRun` / `safeRunSync` apply to a throw
 * that escaped the run loop entirely — as opposed to `collectExecutionFailure`,
 * which folds a throw raised by one *mounted unit* while the loop is still
 * running.
 *
 * Reaching it needs a throw from **outside** the per-mount `try`. The cheapest
 * such site is the mount's value read (`getPathValue(data, key)`), which sits
 * a few lines above the `try` — so an input object with a throwing accessor
 * (a class instance with a computed getter, an ORM entity, a Proxy) drives
 * every branch without a `Container` subclass.
 *
 * These branches were previously covered by nothing: the whole suite stayed
 * green with them replaced by a bare re-throw. That is why each case below
 * carries a mutation that kills it.
 */

/** Input whose `foo` read throws `thrown`, escaping the per-mount try. */
function inputWithThrowingRead(thrown: unknown): { foo: string } {
    return {
        get foo(): string {
            throw thrown;
        },
    };
}

function buildContainer() {
    const container = new Container<{ foo: string }>();
    container.mount('foo', stringValidatorSync);
    return container;
}

/** Assert + narrow to the single synthetic issue `wrapSafeRunError` emits. */
function expectSingleItem(error: ValidupError) {
    expect(error.issues).toHaveLength(1);

    const [issue] = error.issues;
    expect(isIssueItem(issue)).toBe(true);
    if (!isIssueItem(issue)) {
        throw new Error('unreachable');
    }

    return issue;
}

describe('safeRun error fold', () => {
    describe('Error branch', () => {
        it('should fold an Error thrown outside the run loop into one path-less item', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead(new Error('GETTER_BOOM')));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            const issue = expectSingleItem(result.error);
            expect(issue.path).toEqual([]);
            expect(issue.message).toBe('GETTER_BOOM');
            expect(issue.code).toBe(IssueCode.VALUE_INVALID);
        });

        it('should fold the same way through safeRunSync', () => {
            const result = buildContainer().safeRunSync(inputWithThrowingRead(new Error('GETTER_BOOM')));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            const issue = expectSingleItem(result.error);
            expect(issue.path).toEqual([]);
            expect(issue.message).toBe('GETTER_BOOM');
            expect(issue.code).toBe(IssueCode.VALUE_INVALID);
        });

        it('should keep an Error subclass message verbatim', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead(new TypeError('not callable')));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(expectSingleItem(result.error).message).toBe('not callable');
        });

        it('should keep an empty Error message empty rather than stringifying the Error', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead(new Error('')));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(expectSingleItem(result.error).message).toBe('');
        });

        it('should take the Error branch for a duck-typed error object', async () => {
            // `isError` is duck-typed on string `name` + `message`, so a plain
            // object carrying both is folded as an Error — NOT stringified.
            const result = await buildContainer().safeRun(
                inputWithThrowingRead({ name: 'DuckError', message: 'quack' }),
            );

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(expectSingleItem(result.error).message).toBe('quack');
        });
    });

    describe('non-Error branch', () => {
        it('should surface a non-empty thrown string verbatim', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead('BARE_STRING_THROW'));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            const issue = expectSingleItem(result.error);
            expect(issue.message).toBe('BARE_STRING_THROW');
            expect(issue.path).toEqual([]);
            expect(issue.code).toBe(IssueCode.VALUE_INVALID);
        });

        it('should prefix an empty thrown string (the verbatim case needs length > 0)', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead(''));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(expectSingleItem(result.error).message).toBe('Non-Error throw: ');
        });

        it('should stringify a thrown plain object', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead({ notAnError: true }));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(expectSingleItem(result.error).message).toBe('Non-Error throw: [object Object]');
        });

        it('should stringify a thrown null', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead(null));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(expectSingleItem(result.error).message).toBe('Non-Error throw: null');
        });

        it('should never return success:false with an empty issue list', async () => {
            const result = await buildContainer().safeRun(inputWithThrowingRead(Symbol('nope')));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(result.error.issues.length).toBeGreaterThan(0);
            expect(result.error.toJSON().issues).toBe(result.error.issues);
        });
    });

    describe('ValidupError passthrough', () => {
        it('should return the very same ValidupError instance', async () => {
            const thrown = new ValidupError([
                defineIssueItem({ path: ['deep', 'inner'], message: 'from the getter' }),
            ]);

            const result = await buildContainer().safeRun(inputWithThrowingRead(thrown));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            // Identity, not equality — folding this branch through the shared
            // cascade would rebuild a fresh ValidupError and drop `cause`,
            // subclass identity and any custom property. Identity also
            // subsumes "issue paths are untouched": same object, same issues,
            // so no path reset and no prefixing can have happened.
            expect(result.error).toBe(thrown);
        });

        it('should preserve a ValidupError subclass and its custom properties', async () => {
            class TicketedValidupError extends ValidupError {
                readonly ticket = 'T-42';
            }

            const thrown = new TicketedValidupError([
                defineIssueItem({ path: ['foo'], message: 'nope' }),
            ]);

            const result = await buildContainer().safeRun(inputWithThrowingRead(thrown));

            expect(result.success).toBe(false);
            if (result.success) {
                throw new Error('unreachable');
            }

            expect(result.error).toBeInstanceOf(TicketedValidupError);
            expect((result.error as TicketedValidupError).ticket).toBe('T-42');
        });
    });

    describe('structural carve-out sits above the fold', () => {
        it('should re-throw a PathsStrictViolationError instead of folding it', async () => {
            const thrown = new PathsStrictViolationError({ pathsToInclude: ['bar'] });

            await expect(buildContainer().safeRun(inputWithThrowingRead(thrown)))
                .rejects.toBe(thrown);
        });

        it('should re-throw a duck-typed RunSyncViolationError instead of folding it', () => {
            const thrown = { name: 'RunSyncViolationError', message: 'nope' };

            // Identity, not a bare `.toThrow()`. "Something threw" stays green
            // even when the re-throw is replaced by `throw new Error(...)` —
            // which is exactly what breaks a consumer's
            // `catch (e) { if (isRunSyncViolation(e)) … }`.
            expect.assertions(1);
            try {
                buildContainer().safeRunSync(inputWithThrowingRead(thrown));
            } catch (e) {
                expect(e).toBe(thrown);
            }
        });

        it('should re-throw a ValidupError raised during an aborted run', async () => {
            // The ordering invariant: the structural check sits ABOVE the
            // `isValidupError` passthrough. An aborted run re-raises whatever
            // was in flight — including a plain validation `ValidupError` —
            // rather than reshaping it into a `Result.failure`. Swap the two
            // blocks and this is the only case in the suite that notices.
            //
            // The getter aborts before throwing so the signal is live at the
            // pre-mount `throwIfAborted()` probe and aborted by the time
            // `wrapSafeRunError` reads it.
            const controller = new AbortController();
            const thrown = new ValidupError([
                defineIssueItem({ path: ['foo'], message: 'raced the abort' }),
            ]);

            const input: { foo: string } = {
                get foo(): string {
                    controller.abort();
                    throw thrown;
                },
            };

            await expect(buildContainer().safeRun(input, { signal: controller.signal }))
                .rejects.toBe(thrown);
        });
    });
});
