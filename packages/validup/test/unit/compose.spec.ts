/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    IssueCode,
    ValidupError,
    compose,
    createValidupError,
    flattenIssueItems,
} from '../../src';
import type { Validator } from '../../src';

function isString(): Validator {
    return (ctx) => {
        if (typeof ctx.value !== 'string') {
            throw createValidupError(ctx.value, IssueCode.VALUE_INVALID, 'must be a string');
        }
        return ctx.value;
    };
}

function minLength(min: number): Validator {
    return (ctx) => {
        const s = String(ctx.value);
        if (s.length < min) {
            throw createValidupError(
                ctx.value,
                IssueCode.MIN_LENGTH,
                `min length is ${min}`,
                { min },
            );
        }
        return ctx.value;
    };
}

function matchesPattern(pattern: RegExp): Validator {
    return (ctx) => {
        if (!pattern.test(String(ctx.value))) {
            throw createValidupError(
                ctx.value,
                IssueCode.PATTERN,
                'pattern mismatch',
                { pattern: pattern.source },
            );
        }
        return ctx.value;
    };
}

function trim(): Validator {
    // A sanitizer — transforms ctx.value (only relevant for compose's
    // threading semantic, not composeAll).
    return (ctx) => String(ctx.value).trim();
}

async function run(validator: Validator, value: unknown): Promise<unknown> {
    return validator({
        key: '', 
        path: [], 
        value, 
        data: {}, 
        context: undefined,
    });
}

async function captureFail(validator: Validator, value: unknown): Promise<ValidupError> {
    try {
        await run(validator, value);
    } catch (e) {
        if (e instanceof ValidupError) return e;
        throw e;
    }
    throw new Error('expected validator to throw');
}

describe('compose (default — bail: true, fail-fast + threaded)', () => {
    it('returns the (final-stage) value on success', async () => {
        const out = await run(compose([trim(), isString(), minLength(3)]), '  hello  ');
        // trim ran first, so the IS-STRING + MIN-LENGTH stages saw the
        // trimmed value, and `compose` returns the threaded result.
        expect(out).toBe('hello');
    });

    it('stops at the first failure (fail-fast)', async () => {
        const err = await captureFail(compose([isString(), minLength(3)]), 42);
        const items = flattenIssueItems(err.issues);
        // Only the isString failure surfaces — minLength didn't run.
        expect(items).toHaveLength(1);
        expect(items[0]?.message).toBe('must be a string');
    });

    it('threads the value through (output of one → input of next)', async () => {
        // trim() returns the trimmed string; minLength(3) must see 'ab' (2
        // chars) not '  ab  ' (6 chars), so the chain fails on length.
        const err = await captureFail(compose([trim(), minLength(3)]), '  ab  ');
        const items = flattenIssueItems(err.issues);
        expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
    });

    it('treats an undefined-returning validator as pass-through', async () => {
        // `voidCheck` is a pure validator that throws on a bad value but
        // doesn't bother re-emitting `ctx.value`. Without the
        // pass-through rule it would clobber the threaded value to
        // `undefined` and the downstream `minLength` check would see
        // `'undefined'` (the string), passing length 9. With the rule,
        // the trimmed value from the prior stage flows through and the
        // chain returns it cleanly.
        const voidCheck: Validator = (ctx) => {
            if (typeof ctx.value !== 'string') {
                throw new Error('not a string');
            }
            // no return — implicit undefined
        };
        const out = await run(
            compose([trim(), voidCheck, minLength(3)]),
            '  hello  ',
        );
        expect(out).toBe('hello');
    });
});

describe('compose with { bail: false } — collect-all', () => {
    it('passes when all validators pass', async () => {
        const out = await run(
            compose([isString(), minLength(3)], { bail: false }),
            'hello',
        );
        expect(out).toBe('hello');
    });

    it('aggregates multiple failures into one ValidupError', async () => {
        // 'a' fails minLength AND fails the digit-pattern.
        const err = await captureFail(
            compose([
                minLength(3),
                matchesPattern(/[0-9]/),
            ], { bail: false }),
            'a',
        );
        const items = flattenIssueItems(err.issues);
        expect(items).toHaveLength(2);
        const codes = items.map((i) => i.code).sort();
        expect(codes).toEqual([IssueCode.MIN_LENGTH, IssueCode.PATTERN].sort());
    });

    it('threads the value — downstream validators see the transformed input', async () => {
        // trim() runs first and produces 'ab' (length 2). The threaded
        // value flows into minLength(3), which fails because 2 < 3, and
        // into matchesPattern(/[0-9]/), which also fails. Both issues
        // are collected.
        const err = await captureFail(
            compose([
                trim(),
                minLength(3),
                matchesPattern(/[0-9]/),
            ], { bail: false }),
            '  ab  ',
        );
        const items = flattenIssueItems(err.issues);
        expect(items).toHaveLength(2);
        const codes = items.map((i) => i.code).sort();
        expect(codes).toEqual([IssueCode.MIN_LENGTH, IssueCode.PATTERN].sort());
    });

    it('continues past failures', async () => {
        // First validator fails; second still runs and contributes its
        // own failure to the aggregate.
        const err = await captureFail(
            compose([isString(), minLength(10)], { bail: false }),
            42,
        );
        const items = flattenIssueItems(err.issues);
        expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('synthesizes an IssueItem for non-Error throws', async () => {
        const bad: Validator = () => {
            // eslint-disable-next-line no-throw-literal
            throw 'plain string failure';
        };
        const err = await captureFail(compose([bad], { bail: false }), 'x');
        const items = flattenIssueItems(err.issues);
        expect(items).toHaveLength(1);
        expect(items[0]?.message).toBe('plain string failure');
        // Synthesized issues must always carry a code so consumer-side
        // i18n catalogs have something to key off.
        expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
    });

    it('synthesizes an IssueItem for plain Error throws (not ValidupError)', async () => {
        const bad: Validator = () => {
            throw new Error('plain error failure');
        };
        const err = await captureFail(compose([bad], { bail: false }), 'x');
        const items = flattenIssueItems(err.issues);
        expect(items).toHaveLength(1);
        expect(items[0]?.message).toBe('plain error failure');
        expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
    });

    it('returns the threaded value on full success', async () => {
        // Symmetric with bail: true — a trim() stage's transformed
        // value flows through and is what the composed validator
        // returns when every stage passes.
        const out = await run(compose([trim()], { bail: false }), '  hello  ');
        expect(out).toBe('hello');
    });

    it('a throwing stage does not retro-mutate the threaded value', async () => {
        // trim() produces 'ab' → minLength(3) THROWS and so its return
        // never lands; matchesPattern receives the value from the last
        // successful stage ('ab'), not whatever minLength might have
        // tried to mutate. Both failures still surface in the aggregate.
        const err = await captureFail(
            compose([
                trim(),
                minLength(5),         // throws on 'ab'
                matchesPattern(/[0-9]/), // sees 'ab', fails
            ], { bail: false }),
            '  ab  ',
        );
        const items = flattenIssueItems(err.issues);
        const codes = items.map((i) => i.code).sort();
        expect(codes).toEqual([IssueCode.MIN_LENGTH, IssueCode.PATTERN].sort());
    });
});

describe('createValidupError', () => {
    it('builds a single-issue ValidupError with the supplied fields', () => {
        // Ad-hoc string code carries open params; vocabulary codes are
        // gatekept per their documented contract (see the typed-overloads
        // in issue.spec.ts).
        const err = createValidupError(
            42,
            'custom_failure',
            'bad value',
            { foo: 'bar' },
        );
        expect(err).toBeInstanceOf(ValidupError);
        expect(err.issues).toHaveLength(1);
        const items = flattenIssueItems(err.issues);
        expect(items[0]?.code).toBe('custom_failure');
        expect(items[0]?.message).toBe('bad value');
        expect(items[0]?.params).toEqual({ foo: 'bar' });
        expect(items[0]?.received).toBe(42);
    });

    it('omits params when not provided', () => {
        const err = createValidupError(0, IssueCode.REQUIRED, 'required');
        expect(err.issues[0]?.params).toBeUndefined();
    });
});
