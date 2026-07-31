/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { PathsStrictViolationError, ValidupError, defineIssueItem } from '../../src';
// Imported by direct module path on purpose: `structural-throw.ts` is
// deliberately left out of `container/index.ts` (internal plumbing, not public
// API — it composes the private `isRunSyncViolation`). Do not "fix" this by
// adding a barrel line. Same rule as `run-sync-violation.ts`.
import { isStructuralThrow } from '../../src/container/structural-throw';
import { RunSyncViolationError } from '../../src/container/run-sync-violation';

const abortedSignal = (): AbortSignal => {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
};

describe('isStructuralThrow', () => {
    describe('abort leg', () => {
        it('should report an aborted run structural regardless of the thrown value', () => {
            const signal = abortedSignal();

            // The abort leg is a run-state read, not an error-type test: an
            // aborted run re-raises whatever was in flight verbatim.
            expect(isStructuralThrow(new Error('mid-flight'), signal)).toBe(true);
            expect(isStructuralThrow('a raw string throw', signal)).toBe(true);
            expect(isStructuralThrow(undefined, signal)).toBe(true);
        });

        it('should report an aborted run structural even for a ValidupError', () => {
            // `ValidupError` is the ONE value class the two fold sites treat
            // asymmetrically: with no signal it is precisely the thing that
            // gets folded (see "non-structural throws" below), but during an
            // aborted run it must re-raise verbatim like anything else in
            // flight. Without this case the abort leg can be narrowed to
            // `signal?.aborted && !isValidupError(error)` and the whole suite
            // stays green — while `safeRun` silently starts returning a
            // Result where it used to reject. The two integration
            // counterparts live in `safe-run-error.spec.ts` (wrapSafeRunError)
            // and `abort-signal.spec.ts` (collectExecutionFailure).
            const error = new ValidupError([defineIssueItem({ path: ['foo'], message: 'invalid' })]);

            expect(isStructuralThrow(error, abortedSignal())).toBe(true);
        });

        it('should not report a live (non-aborted) signal structural', () => {
            const controller = new AbortController();

            expect(isStructuralThrow(new Error('boom'), controller.signal)).toBe(false);
        });

        it('should re-read the signal rather than snapshot it', () => {
            const controller = new AbortController();
            const error = new Error('boom');

            expect(isStructuralThrow(error, controller.signal)).toBe(false);
            controller.abort();
            expect(isStructuralThrow(error, controller.signal)).toBe(true);
        });
    });

    describe('RunSyncViolationError', () => {
        it('should report a RunSyncViolationError structural without a signal', () => {
            expect(isStructuralThrow(new RunSyncViolationError('nope'))).toBe(true);
        });

        it('should report a duck-typed RunSyncViolationError structural', () => {
            // Cross-realm / duplicate-package copy: `instanceof` fails, the
            // name check must still hold.
            expect(isStructuralThrow({ name: 'RunSyncViolationError' })).toBe(true);
        });
    });

    describe('PathsStrictViolationError', () => {
        it('should report a PathsStrictViolationError structural without a signal', () => {
            const error = new PathsStrictViolationError({ pathsToInclude: ['foo'] });

            expect(isStructuralThrow(error)).toBe(true);
        });

        it('should report a duck-typed PathsStrictViolationError structural', () => {
            expect(isStructuralThrow({ name: 'PathsStrictViolationError' })).toBe(true);
        });
    });

    describe('non-structural throws', () => {
        it('should not report an ordinary Error structural', () => {
            expect(isStructuralThrow(new Error('Value is not a string'))).toBe(false);
            expect(isStructuralThrow(new TypeError('nope'))).toBe(false);
        });

        it('should not report a ValidupError structural', () => {
            // The whole point: a validation failure IS the thing that gets
            // folded into the issue tree.
            const error = new ValidupError([defineIssueItem({ path: ['foo'], message: 'invalid' })]);

            expect(isStructuralThrow(error)).toBe(false);
        });

        it('should not report a non-Error throw structural', () => {
            expect(isStructuralThrow('a raw string throw')).toBe(false);
            expect(isStructuralThrow(null)).toBe(false);
            expect(isStructuralThrow({ name: 'SomeOtherError' })).toBe(false);
        });
    });

    describe('no signal supplied', () => {
        it('should treat an omitted signal as "not aborted"', () => {
            expect(isStructuralThrow(new Error('boom'))).toBe(false);
            expect(isStructuralThrow(new Error('boom'), undefined)).toBe(false);
        });

        it('should still detect the error legs with no signal', () => {
            expect(isStructuralThrow(new RunSyncViolationError('nope'), undefined)).toBe(true);
            expect(isStructuralThrow(new PathsStrictViolationError({ pathsToExclude: ['x'] }), undefined)).toBe(true);
        });
    });
});

