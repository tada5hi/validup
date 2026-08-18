/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { IssueCode } from '@ebec/core';
import { isValidupError } from 'validup';
import type { ValidatorContext } from 'validup';
import { equals } from '../../src';
import { toValidatorString } from '../../src/module';

/**
 * `toValidatorString` is the package's single coercion seam: validator.js
 * predicates all take a `string`, validup mounts carry whatever the input
 * object held. Every factory calls it as the first statement of its `run`,
 * so its table is load-bearing for all 19
 * of them — yet it had no direct spec before this file.
 *
 * The arm that actually matters is `null` / `undefined` → `''`. See the
 * `equals` case at the bottom: it is what makes an absent sibling compare
 * against the empty string rather than the literal text `'undefined'`.
 */
describe('toValidatorString', () => {
    it('returns strings unchanged, including the empty string', () => {
        expect(toValidatorString('abc')).toBe('abc');
        // '' must survive as '' — not be swallowed by the null/undefined arm.
        expect(toValidatorString('')).toBe('');
        expect(toValidatorString('  padded  ')).toBe('  padded  ');
    });

    it('stringifies numbers so numeric fields can mount isInt / isFloat', () => {
        // The documented reason this arm exists: a consumer mounts `isInt()`
        // on a `number`-shaped field without pre-stringifying.
        expect(toValidatorString(42)).toBe('42');
        expect(toValidatorString(-7)).toBe('-7');
        expect(toValidatorString(1.5)).toBe('1.5');
        expect(toValidatorString(0)).toBe('0');
        expect(toValidatorString(-0)).toBe('0');
        expect(toValidatorString(Number.NaN)).toBe('NaN');
        expect(toValidatorString(Number.POSITIVE_INFINITY)).toBe('Infinity');
    });

    it('stringifies booleans', () => {
        expect(toValidatorString(true)).toBe('true');
        expect(toValidatorString(false)).toBe('false');
    });

    it('maps null and undefined to the empty string', () => {
        // NOT 'null' / 'undefined'. A validator.js predicate receiving the
        // literal text 'undefined' would report e.g. isAlpha() as PASSING for
        // an absent value — the empty string fails every format predicate,
        // which is the behaviour mounts rely on.
        expect(toValidatorString(null)).toBe('');
        expect(toValidatorString(undefined)).toBe('');
    });

    it('falls back to String(value) for everything else', () => {
        // Objects, arrays, symbols, bigints — no special handling, but the
        // call must not throw. `String(symbol)` is the one legal symbol
        // coercion (a template literal or `+` would throw a TypeError), so
        // this arm is why a symbol-valued field degrades instead of crashing
        // the whole run.
        expect(toValidatorString({})).toBe('[object Object]');
        expect(toValidatorString({ a: 1 })).toBe('[object Object]');
        expect(toValidatorString([1, 2])).toBe('1,2');
        expect(toValidatorString([])).toBe('');
        expect(toValidatorString(Symbol('x'))).toBe('Symbol(x)');
        expect(toValidatorString(10n)).toBe('10');
        expect(toValidatorString(new Date(0))).toBe(String(new Date(0)));
        expect(toValidatorString(() => 1)).toContain('=>');
    });

    // NOTE: there is deliberately no "never throws for any ordinary value"
    // sweep here. Such a test can only assert `typeof … === 'string'`, and
    // every arm of the implementation returns a string by construction — so
    // no value-level mutation could fail it (`return String(value)` →
    // `return String(value).toUpperCase()` stays green). Every value it
    // covered is already asserted concretely by the four cases above, and the
    // one genuinely interesting non-throw case is pinned below.

    it('propagates the TypeError for a null-prototype object', () => {
        // `Object.create(null)` has no inherited `toString`, so `String(value)`
        // throws. Pinned rather than hidden: the helper does NOT defend against
        // it, and a raw TypeError escaping a mount is materially different from
        // a ValidupError. If that is ever deemed wrong, this is the test to
        // change deliberately.
        expect(() => toValidatorString(Object.create(null))).toThrow(TypeError);
    });
});

describe('toValidatorString: the consequence for equals()', () => {
    // The `null`/`undefined` → '' arm is the only one whose behaviour a
    // factory depends on rather than merely tolerating. `equals(key)` reads
    // the sibling through `getPathValue(ctx.data, key)`; when that key is
    // absent the result is `undefined`, and the comparison target must be ''.

    function runEquals(value: unknown, data: Record<string, unknown>) {
        const ctx: ValidatorContext<unknown> = {
            key: 'passwordConfirm',
            path: ['passwordConfirm'],
            value,
            data,
            context: undefined,
        };
        try {
            return { ok: true as const, value: equals('password').run(ctx) };
        } catch (error) {
            if (!isValidupError(error)) throw error;
            return { ok: false as const, code: (error.issues[0] as any).code };
        }
    }

    it('compares an absent sibling against the empty string, not "undefined"', () => {
        // If `toValidatorString(undefined)` returned 'undefined', this input
        // would PASS — a passwordConfirm field literally containing the text
        // "undefined" would be accepted while `password` was unset.
        expect(runEquals('undefined', {})).toEqual({ ok: false, code: IssueCode.SAME_AS });
        // …and the empty string is what actually matches an absent sibling.
        expect(runEquals('', {})).toEqual({ ok: true, value: '' });
    });

    it('compares a null sibling against the empty string too', () => {
        expect(runEquals('null', { password: null })).toEqual({ ok: false, code: IssueCode.SAME_AS });
        expect(runEquals('', { password: null })).toEqual({ ok: true, value: '' });
    });
});
