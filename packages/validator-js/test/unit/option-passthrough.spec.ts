/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { IssueCode, isValidupError } from 'validup';
import type { ValidatorDescriptor } from 'validup';
import {
    isAlpha,
    isAlphanumeric,
    isBase64,
    isDate,
    isDecimal,
    isEmail,
    isFloat,
    isIP,
    isISO8601,
    isInt,
    isJSON,
    isLength,
    isMACAddress,
    isNumeric,
    isStrongPassword,
    isURL,
    isUUID,
    matches,
} from '../../src';

/**
 * Each factory's options must reach the right validator.js ARGUMENT POSITION.
 *
 * validator.js is inconsistent about how options arrive — a flat bag for
 * `isEmail`, a positional argument for `isUUID` / `isIP`, a positional locale
 * PLUS a bag for `isAlpha`, a branch on the factory argument for `matches` —
 * so every factory hand-wires its own call. That call is the one place a
 * mis-wire can hide, and it is invisible to `issue-shape.spec.ts`'s
 * code/message/data table: that table calls every factory with DEFAULT
 * options, so an option silently dropped on the floor still produces the
 * documented triple.
 *
 * Every row below is therefore built as a PAIR — the same input judged by the
 * factory with and without the option. The row is only meaningful because the
 * two disagree; a dropped option collapses them and the test fails.
 */

type Verdict = 'pass' | 'fail';

function verdictOf(descriptor: ValidatorDescriptor, value: unknown): Verdict {
    try {
        descriptor.run({
            key: 'field',
            path: ['field'],
            value,
            data: { field: value },
            context: undefined,
        });
        return 'pass';
    } catch (error) {
        if (!isValidupError(error)) throw error;
        return 'fail';
    }
}

const FLIPS: {
    name: string,
    value: unknown,
    withOption: ValidatorDescriptor,
    withoutOption: ValidatorDescriptor,
    expected: Verdict,
}[] = [
    // --- flat option bag, forwarded wholesale -------------------------------
    {
        name: 'isEmail forwards require_display_name',
        value: 'user@example.com',
        withOption: isEmail({ require_display_name: true }),
        withoutOption: isEmail(),
        expected: 'fail',
    },
    {
        name: 'isEmail require_display_name accepts a display name',
        value: 'Name <user@example.com>',
        withOption: isEmail({ require_display_name: true }),
        withoutOption: isEmail(),
        expected: 'pass',
    },
    {
        name: 'isURL forwards require_protocol',
        value: 'example.com',
        withOption: isURL({ require_protocol: true }),
        withoutOption: isURL(),
        expected: 'fail',
    },
    {
        name: 'isNumeric forwards no_symbols',
        value: '+1',
        withOption: isNumeric({ no_symbols: true }),
        withoutOption: isNumeric(),
        expected: 'fail',
    },
    {
        name: 'isDecimal forwards decimal_digits',
        value: '1.234',
        withOption: isDecimal({ decimal_digits: '1,2' }),
        withoutOption: isDecimal(),
        expected: 'fail',
    },
    {
        name: 'isDecimal forwards locale',
        value: '1,23',
        withOption: isDecimal({ locale: 'de-DE' }),
        withoutOption: isDecimal(),
        expected: 'pass',
    },
    {
        name: 'isMACAddress forwards no_separators (rejects separated)',
        value: '01:23:45:67:89:ab',
        withOption: isMACAddress({ no_separators: true }),
        withoutOption: isMACAddress(),
        expected: 'fail',
    },
    {
        name: 'isMACAddress forwards no_separators (accepts bare)',
        value: '0123456789ab',
        withOption: isMACAddress({ no_separators: true }),
        withoutOption: isMACAddress(),
        expected: 'pass',
    },
    {
        name: 'isDate forwards format (accepts the declared shape)',
        value: '01/02/2020',
        withOption: isDate({ format: 'DD/MM/YYYY' }),
        withoutOption: isDate(),
        expected: 'pass',
    },
    {
        name: 'isDate forwards format (rejects the default shape)',
        value: '2020-01-01',
        withOption: isDate({ format: 'DD/MM/YYYY' }),
        withoutOption: isDate(),
        expected: 'fail',
    },
    {
        name: 'isISO8601 forwards strict',
        value: '2020-02-31',
        withOption: isISO8601({ strict: true }),
        withoutOption: isISO8601(),
        expected: 'fail',
    },
    {
        name: 'isJSON forwards allow_primitives',
        value: 'null',
        withOption: isJSON({ allow_primitives: true }),
        withoutOption: isJSON(),
        expected: 'pass',
    },
    {
        name: 'isBase64 forwards urlSafe (accepts url-safe alphabet)',
        value: 'aGVsbG8-_w',
        withOption: isBase64({ urlSafe: true }),
        withoutOption: isBase64(),
        expected: 'pass',
    },
    {
        name: 'isBase64 forwards urlSafe (rejects padding)',
        value: 'aGVsbG8=',
        withOption: isBase64({ urlSafe: true }),
        withoutOption: isBase64(),
        expected: 'fail',
    },
    {
        name: 'isStrongPassword forwards minLength',
        value: 'Aa1!aaaa',
        withOption: isStrongPassword({ minLength: 12 }),
        withoutOption: isStrongPassword(),
        expected: 'fail',
    },

    // --- positional second argument ----------------------------------------
    {
        name: 'isUUID forwards version positionally (rejects a v1 as v4)',
        value: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
        withOption: isUUID({ version: 4 }),
        withoutOption: isUUID(),
        expected: 'fail',
    },
    {
        name: 'isIP forwards version positionally (rejects IPv4 as v6)',
        value: '192.168.0.1',
        withOption: isIP({ version: 6 }),
        withoutOption: isIP(),
        expected: 'fail',
    },

    // --- positional locale PLUS an option bag ------------------------------
    {
        name: 'isAlpha forwards locale (positional 2nd arg)',
        value: 'äöü',
        withOption: isAlpha({ locale: 'de-DE' }),
        withoutOption: isAlpha(),
        expected: 'pass',
    },
    {
        name: 'isAlpha forwards ignore (options bag, 3rd arg)',
        value: 'ab-c',
        withOption: isAlpha({ ignore: '-' }),
        withoutOption: isAlpha(),
        expected: 'pass',
    },
    {
        name: 'isAlphanumeric forwards locale (positional 2nd arg)',
        value: 'äöü1',
        withOption: isAlphanumeric({ locale: 'de-DE' }),
        withoutOption: isAlphanumeric(),
        expected: 'pass',
    },
    {
        name: 'isAlphanumeric forwards ignore (options bag, 3rd arg)',
        value: 'a-1',
        withOption: isAlphanumeric({ ignore: '-' }),
        withoutOption: isAlphanumeric(),
        expected: 'pass',
    },

    // --- shape branches on the factory argument ----------------------------
    {
        name: 'matches forwards modifiers on the string-pattern overload',
        value: 'ABC',
        withOption: matches('abc', { modifiers: 'i' }),
        withoutOption: matches('abc'),
        expected: 'pass',
    },
];

describe('option pass-through: every factory reaches the right validator.* argument', () => {
    for (const row of FLIPS) {
        it(row.name, () => {
            expect(verdictOf(row.withOption, row.value)).toBe(row.expected);
            // The control. If the option were dropped, the two descriptors
            // would agree and this line would fail — which is what makes the
            // assertion above evidence rather than decoration.
            expect(verdictOf(row.withoutOption, row.value)).toBe(
                row.expected === 'pass' ? 'fail' : 'pass',
            );
        });
    }
});

describe('option pass-through: positional arguments are not passed as objects', () => {
    // `isUUID(s, version)` takes a bare version, NOT an options object —
    // `validator.isUUID(uuid, { version: 1 })` returns false for every input.
    // A factory that forwarded `options` instead of `options.version` would
    // therefore reject everything, which the flip table above cannot catch:
    // its `isUUID` row expects a FAILURE, and a mis-wire fails too.
    it('isUUID accepts a matching UUID under an explicit version', () => {
        expect(verdictOf(isUUID({ version: 1 }), 'a8098c1a-f86e-11da-bd1a-00112444be1e')).toBe('pass');
        expect(verdictOf(isUUID({ version: 4 }), '123e4567-e89b-42d3-a456-426614174000')).toBe('pass');
    });

    it('isIP accepts a matching address under an explicit version', () => {
        // NOTE: unlike `isUUID`, validator 13's `isIP` accepts BOTH
        // `isIP(s, 6)` and `isIP(s, { version: 6 })`, so this pair does not
        // discriminate the two wirings — it only pins that the version is
        // forwarded at all. The flip row above carries that weight.
        expect(verdictOf(isIP({ version: 6 }), '::1')).toBe('pass');
        expect(verdictOf(isIP({ version: 4 }), '192.168.0.1')).toBe('pass');
        expect(verdictOf(isIP({ version: 4 }), '::1')).toBe('fail');
    });

    it('isAlpha passes locale positionally, not inside the options bag', () => {
        // `validator.isAlpha(s, { locale: 'de-DE' }, {})` THROWS
        // "Invalid locale '[object Object]'" — a mis-wire here would surface
        // as a raw Error escaping the mount rather than a ValidupError.
        expect(() => verdictOf(isAlpha({ locale: 'de-DE' }), 'äöü')).not.toThrow();
        expect(verdictOf(isAlpha({ locale: 'de-DE' }), 'äöü')).toBe('pass');
    });

    it('matches honours the RegExp\'s own flags on the RegExp overload', () => {
        // What this DOES pin: the RegExp reaches validator.js intact, so its
        // own flags decide case-sensitivity.
        //
        // What it does NOT pin, contrary to an earlier version of this
        // comment: that `modifiers` is withheld from the RegExp overload.
        // `validator/lib/matches.js` only rebuilds the pattern when
        // `Object.prototype.toString.call(pattern) !== '[object RegExp]'`, so
        // a third argument is simply IGNORED for a RegExp — adding
        // `options.modifiers` to that call is an equivalent mutant against
        // validator 13 and no test can distinguish it. The two-branch call
        // shape in `comparison.ts` is therefore a correctness margin against a
        // future validator.js that starts honouring the argument, not
        // behaviour observable today.
        expect(verdictOf(matches(/abc/i), 'ABC')).toBe('pass');
        expect(verdictOf(matches(/abc/), 'ABC')).toBe('fail');
        expect(verdictOf(matches(/abc/), 'abc')).toBe('pass');
        // The string overload is where `modifiers` is genuinely load-bearing;
        // the flip table above carries that weight.
        expect(verdictOf(matches('abc', { modifiers: 'i' }), 'ABC')).toBe('pass');
        expect(verdictOf(matches('abc'), 'ABC')).toBe('fail');
    });
});

describe('option pass-through: the string-pattern overload carries the same data payload', () => {
    it('reports the raw string as data.pattern', () => {
        // The RegExp overload uses `pattern.source`; the string overload uses
        // the string verbatim. Both must land on `data.pattern` so an i18n
        // template has one shape to render.
        try {
            matches('^ab+c$').run({
                key: 'field',
                path: ['field'],
                value: 'zzz',
                data: {},
                context: undefined,
            });
            throw new Error('expected the validator to throw');
        } catch (error) {
            if (!isValidupError(error)) throw error;
            const issue = error.issues[0] as any;
            expect(issue.code).toBe(IssueCode.PATTERN);
            expect(issue.data).toEqual({ pattern: '^ab+c$' });
        }
    });

    it('returns ctx.value untouched when the string pattern matches', () => {
        const out = matches('^ab+c$').run({
            key: 'field',
            path: ['field'],
            value: 'abbbc',
            data: {},
            context: undefined,
        });
        expect(out).toBe('abbbc');
    });
});

/* ------------------------------------------------------------------ */
/* the pipeline factories: type-failure vs range-failure must not merge */
/* ------------------------------------------------------------------ */

function codeOf(descriptor: ValidatorDescriptor, value: unknown): string | undefined {
    try {
        descriptor.run({
            key: 'field',
            path: ['field'],
            value,
            data: { field: value },
            context: undefined,
        });
        return undefined;
    } catch (error) {
        if (!isValidupError(error)) throw error;
        return (error.issues[0] as any).code;
    }
}

describe('isInt / isFloat / isLength keep type-failure separate from range-failure', () => {
    // These three are pipelines, not predicates: one boolean cannot express
    // their outcome. If a later refactor folds them behind a single
    // `(code, message, data)` triple, every row here collapses onto one code —
    // which is what this table exists to prevent.

    it('isInt reports the TYPE failure even when a range bound is also declared', () => {
        // The inputs must violate BOTH gates, or the ordering is untested.
        //
        // A non-numeric string like 'abc' does NOT qualify: `Number('abc')` is
        // NaN, and every comparison in `assertNumericRange` against NaN is
        // already false, so only one branch is ever violated and hoisting the
        // ladder above the type gate would go unnoticed. '5.5' / '1e3' / ' 12 '
        // are the real competitors — `validator.isInt` rejects each while
        // `Number(...)` yields a finite value below `min`.
        expect(codeOf(isInt({ min: 100 }), '5.5')).toBe(IssueCode.INTEGER);
        expect(codeOf(isInt({ min: 100 }), '1e3')).toBe(IssueCode.INTEGER);
        expect(codeOf(isInt({ min: 100, max: 200 }), ' 12 ')).toBe(IssueCode.INTEGER);
        // Counterfactual: the SAME values pass the ladder outright once the
        // bound is removed, proving the range branch really was live above.
        expect(codeOf(isInt({ min: 1 }), '5.5')).toBe(IssueCode.INTEGER);
        // …and a genuine range failure still reports the range code.
        expect(codeOf(isInt({ min: 100 }), 5)).toBe(IssueCode.MIN_VALUE);
        expect(codeOf(isInt({ max: 200 }), 500)).toBe(IssueCode.MAX_VALUE);
        // A NaN-coercing input still reports INTEGER (the degenerate case the
        // old spec relied on) — kept, but it is no longer the whole evidence.
        expect(codeOf(isInt({ min: 100 }), 'abc')).toBe(IssueCode.INTEGER);
    });

    it('isFloat reports the TYPE failure even when a range bound is also declared', () => {
        // Same trap as `isInt`: 'abc' coerces to NaN and cannot compete.
        // `validator.isFloat(' 12 ')` is false while `Number(' 12 ')` is 12,
        // so ' 12 ' violates the type gate AND `min: 100`.
        expect(codeOf(isFloat({ min: 100 }), ' 12 ')).toBe(IssueCode.DECIMAL);
        expect(codeOf(isFloat({ max: 5 }), ' 12 ')).toBe(IssueCode.DECIMAL);
        expect(codeOf(isFloat({ min: 100 }), 'abc')).toBe(IssueCode.DECIMAL);
        expect(codeOf(isFloat({ min: 1.5 }), 0.5)).toBe(IssueCode.MIN_VALUE);
        expect(codeOf(isFloat({ max: 1.5 }), 2.5)).toBe(IssueCode.MAX_VALUE);
    });

    it('isLength keeps MIN_LENGTH and MAX_LENGTH distinct under a two-sided bound', () => {
        expect(codeOf(isLength({ min: 3, max: 5 }), 'ab')).toBe(IssueCode.MIN_LENGTH);
        expect(codeOf(isLength({ min: 3, max: 5 }), 'abcdef')).toBe(IssueCode.MAX_LENGTH);
        expect(codeOf(isLength({ min: 3, max: 5 }), 'abcd')).toBeUndefined();
    });
});

describe('assertNumericRange: the bound ladder order decides data, not just code', () => {
    // `min`/`gt` both emit MIN_VALUE and `max`/`lt` both emit MAX_VALUE, so a
    // reorder inside a pair is INVISIBLE in `code` — it only changes which
    // number lands in `data`, i.e. what an i18n template renders. Every row
    // below picks bounds that BOTH sides violate, so the assertion is about
    // precedence rather than about which single bound happened to fail.

    function dataOf(descriptor: ValidatorDescriptor, value: unknown): unknown {
        try {
            descriptor.run({
                key: 'field',
                path: ['field'],
                value,
                data: { field: value },
                context: undefined,
            });
            return undefined;
        } catch (error) {
            if (!isValidupError(error)) throw error;
            return (error.issues[0] as any).data;
        }
    }

    it('min wins over gt (both violated, same code, different data)', () => {
        // 0 < 5 and 0 <= 20 — both branches fire; `min` must be reported.
        expect(codeOf(isInt({ min: 5, gt: 20 }), 0)).toBe(IssueCode.MIN_VALUE);
        expect(dataOf(isInt({ min: 5, gt: 20 }), 0)).toEqual({ min: 5 });
        expect(dataOf(isFloat({ min: 5, gt: 20 }), 0.5)).toEqual({ min: 5 });
    });

    it('max wins over lt (both violated, same code, different data)', () => {
        // 100 > 20 and 100 >= 5 — both branches fire; `max` must be reported.
        expect(codeOf(isInt({ max: 20, lt: 5 }), 100)).toBe(IssueCode.MAX_VALUE);
        expect(dataOf(isInt({ max: 20, lt: 5 }), 100)).toEqual({ max: 20 });
        expect(dataOf(isFloat({ max: 20, lt: 5 }), 100.5)).toEqual({ max: 20 });
    });

    it('min wins over lt (different codes — the pair that also flips code)', () => {
        expect(codeOf(isInt({ min: 5, lt: 1 }), 2)).toBe(IssueCode.MIN_VALUE);
        expect(dataOf(isInt({ min: 5, lt: 1 }), 2)).toEqual({ min: 5 });
    });

    it('gt wins over max (the cross-pair ordering)', () => {
        // 2 <= 10 (gt violated) and 2 > 1 (max violated) — `gt` is checked
        // first, so MIN_VALUE with data.min = the `gt` boundary.
        expect(codeOf(isInt({ gt: 10, max: 1 }), 2)).toBe(IssueCode.MIN_VALUE);
        expect(dataOf(isInt({ gt: 10, max: 1 }), 2)).toEqual({ min: 10 });
    });
});
