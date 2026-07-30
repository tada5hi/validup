/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { IssueCode, createValidupError, isValidupError } from 'validup';
import type { ValidatorContext, ValidatorDescriptor } from 'validup';
import {
    equals,
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
import { toValidatorString } from '../../src/module';

function contextFor(value: unknown, data: Record<string, unknown> = {}): ValidatorContext<unknown> {
    return {
        key: 'field',
        path: ['field'],
        value,
        data: { ...data, field: value },
        context: undefined,
    };
}

type Outcome =    | { ok: true, value: unknown } |
    {
        ok: false,
        code: string,
        message: string,
        data?: Record<string, unknown>
    };

function run(descriptor: ValidatorDescriptor, value: unknown, data: Record<string, unknown> = {}): Outcome {
    try {
        return { ok: true, value: descriptor.run(contextFor(value, data)) };
    } catch (error) {
        if (!isValidupError(error)) throw error;
        const issue = error.issues[0] as any;
        return {
            ok: false,
            code: issue.code,
            message: issue.message,
            data: issue.data,
        };
    }
}

/* ------------------------------------------------------------------ */
/* the code → message → data contract, as a table                      */
/* ------------------------------------------------------------------ */

/**
 * Every factory whose failure is ONE `(code, message, data)` triple, in
 * one place. Each factory body writes its own triple by hand, so a table
 * is the only thing that makes a drifting default visible next to its
 * siblings.
 *
 * `isInt` / `isFloat` / `isLength` are absent on purpose — they are
 * pipelines that select from several triples at run time. Their branch
 * tables live in `factories.spec.ts`; the type-failure-vs-range-failure
 * split is pinned further down.
 */
const CONTRACT: {
    name: string,
    descriptor: ValidatorDescriptor,
    passing: unknown,
    failing: unknown,
    data?: Record<string, unknown>,
    code: string,
    message: string,
    payload?: Record<string, unknown>,
    sideEffect?: boolean,
}[] = [
    {
        name: 'isEmail',
        descriptor: isEmail(),
        passing: 'user@example.com',
        failing: 'nope',
        code: IssueCode.EMAIL,
        message: 'The value is not a valid email address',
    },
    {
        name: 'isURL',
        descriptor: isURL(),
        passing: 'https://example.com',
        failing: 'not a url',
        code: IssueCode.URL,
        message: 'The value is not a valid URL',
    },
    {
        name: 'isUUID',
        descriptor: isUUID(),
        passing: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
        failing: 'nope',
        code: IssueCode.UUID,
        message: 'The value is not a valid UUID',
    },
    {
        name: 'isIP',
        descriptor: isIP(),
        passing: '192.168.0.1',
        failing: 'nope',
        code: IssueCode.IP_ADDRESS,
        message: 'The value is not a valid IP address',
    },
    {
        name: 'isMACAddress',
        descriptor: isMACAddress(),
        passing: '01:23:45:67:89:ab',
        failing: 'nope',
        code: IssueCode.MAC_ADDRESS,
        message: 'The value is not a valid MAC address',
    },
    {
        name: 'isDate',
        descriptor: isDate(),
        passing: '2020-01-01',
        failing: 'nope',
        code: IssueCode.DATE,
        message: 'The value is not a valid date',
    },
    {
        name: 'isISO8601',
        descriptor: isISO8601(),
        passing: '2020-01-01',
        failing: 'nope',
        code: IssueCode.DATE,
        message: 'The value is not a valid date',
    },
    {
        name: 'isJSON',
        descriptor: isJSON(),
        passing: '{"a":1}',
        failing: 'nope',
        code: IssueCode.JSON,
        message: 'The value is not valid JSON',
    },
    {
        name: 'isBase64',
        descriptor: isBase64(),
        passing: 'aGVsbG8=',
        failing: '!!!',
        code: IssueCode.BASE64,
        message: 'The value is not valid base64',
    },
    {
        name: 'isAlpha',
        descriptor: isAlpha(),
        passing: 'abc',
        failing: 'abc123',
        code: IssueCode.ALPHA,
        message: 'The value is not alphabetical',
    },
    {
        name: 'isAlphanumeric',
        descriptor: isAlphanumeric(),
        passing: 'abc123',
        failing: 'abc-123',
        code: IssueCode.ALPHA_NUM,
        message: 'The value must be alphanumeric',
    },
    {
        name: 'isNumeric',
        descriptor: isNumeric(),
        passing: '123',
        failing: 'abc',
        code: IssueCode.NUMERIC,
        message: 'The value must be numeric',
    },
    {
        name: 'isDecimal',
        descriptor: isDecimal(),
        passing: '1.5',
        failing: 'abc',
        code: IssueCode.DECIMAL,
        message: 'The value must be a decimal number',
    },
    {
        name: 'matches',
        descriptor: matches(/^\d+$/),
        passing: '123',
        failing: 'abc',
        code: IssueCode.PATTERN,
        message: 'The value does not match the expected pattern',
        payload: { pattern: '^\\d+$' },
    },
    {
        name: 'equals (sibling)',
        descriptor: equals('password'),
        data: { password: 'abc' },
        passing: 'abc',
        failing: 'xyz',
        code: IssueCode.SAME_AS,
        message: 'The value must equal password',
        payload: { other: 'password' },
        sideEffect: true,
    },
    {
        name: 'equals (expectedValue)',
        descriptor: equals('password', { expectedValue: 'abc' }),
        passing: 'abc',
        failing: 'xyz',
        code: IssueCode.SAME_AS,
        message: 'The value must equal password',
        payload: { other: 'password' },
        sideEffect: false,
    },
    {
        name: 'isStrongPassword',
        descriptor: isStrongPassword({ minLength: 12, minNumbers: 2 }),
        passing: 'Aa1!aaaaaa22',
        failing: 'a',
        code: IssueCode.STRONG_PASSWORD,
        message: 'The value does not meet the password strength requirements',
        payload: { minLength: 12, minNumbers: 2 },
    },
];

describe('the code → message → data contract', () => {
    for (const row of CONTRACT) {
        it(`${row.name} emits the documented triple`, () => {
            const failure = run(row.descriptor, row.failing, row.data ?? {});
            expect(failure.ok).toBe(false);
            if (failure.ok) return;
            expect(failure.code).toBe(row.code);
            expect(failure.message).toBe(row.message);
            expect(failure.data).toEqual(row.payload);
        });

        it(`${row.name} returns ctx.value untouched on success`, () => {
            // NOTE: every `passing` fixture in this table is a string, and for
            // a string `ctx.value === toValidatorString(ctx.value)`. So this
            // row pins that SOMETHING equal to the input comes back — it can
            // NOT tell `return ctx.value` from `return s`. The identity table
            // below is the one that discriminates; keep fixtures there.
            const success = run(row.descriptor, row.passing, row.data ?? {});
            expect(success).toEqual({ ok: true, value: row.passing });
        });

        it(`${row.name} declares sideEffect=${String(row.sideEffect)}`, () => {
            expect(row.descriptor.sideEffect).toBe(row.sideEffect);
        });
    }

    it('honours a message override on every single-triple factory', () => {
        const overrides: ValidatorDescriptor[] = [
            isEmail({ message: 'custom' }),
            isURL({ message: 'custom' }),
            isUUID({ message: 'custom' }),
            isIP({ message: 'custom' }),
            isMACAddress({ message: 'custom' }),
            isDate({ message: 'custom' }),
            isISO8601({ message: 'custom' }),
            isJSON({ message: 'custom' }),
            isBase64({ message: 'custom' }),
            isAlpha({ message: 'custom' }),
            isAlphanumeric({ message: 'custom' }),
            isNumeric({ message: 'custom' }),
            isDecimal({ message: 'custom' }),
            matches(/^\d+$/, { message: 'custom' }),
            equals('password', { message: 'custom' }),
            isStrongPassword({ minLength: 40, message: 'custom' }),
        ];

        // One fixture that fails all sixteen. The NUL stays an ESCAPE, never
        // the literal byte — a raw 0x00 makes `file(1)` report this spec as
        // `data` and makes `grep` skip it, silently dropping the file out of
        // every grep-based audit. See `.agents/conventions.md` → Code Style.
        for (const descriptor of overrides) {
            const outcome = run(descriptor, '\u0000 not-valid !!', { password: 'other' });
            expect(outcome.ok).toBe(false);
            if (outcome.ok) continue;
            expect(outcome.message).toBe('custom');
        }
    });
});

/* ------------------------------------------------------------------ */
/* value identity — `ctx.value` back, never the stringified probe      */
/* ------------------------------------------------------------------ */

/**
 * Every factory opens its `run` by coercing through `toValidatorString`
 * and closes it by returning `ctx.value` — the ORIGINAL value, never the
 * coerced probe `s`. Nineteen such `return ctx.value` sites are spread
 * across the four factory modules, each hand-written, so the drift is
 * per-factory and a table is the only thing that sees it. (A twentieth
 * lives in `createValidatorJsValidator`; `createValidator.spec.ts` pins that one.)
 *
 * The contract table above cannot: all seventeen of its `passing`
 * fixtures are strings, and for a string the two are indistinguishable.
 * Mutating all nineteen sites to `return s` leaves 199 of the package's
 * 200 tests green without this block — the lone survivor being `isInt`'s
 * numeric fixture over in `factories.spec.ts`.
 *
 * The defect that hides there is a silent retype of validated output:
 * the coercion exists so a consumer can mount `isInt()` on a
 * `number`-shaped field without pre-stringifying, so a factory returning
 * `s` turns `output.age` from `42` into `'42'` — all the way into an API
 * response body, with every issue-shape assertion still passing.
 *
 * Each row therefore feeds a passing value that is NOT its own
 * stringification. Where the factory's vocabulary admits a non-string the
 * fixture is that natural value (numbers for the numeric / length /
 * pattern factories, a boolean for `isAlpha`, whose `'true'` is
 * alphabetical). The string-format factories accept nothing but a
 * well-formed string, so their fixture is an object whose `toString()`
 * returns one: `toValidatorString` falls through to `String(value)` for
 * objects, so the probe passes while the value stays distinguishable by
 * reference.
 */
describe('every factory returns ctx.value, never the stringified probe', () => {
    const boxed = (value: string) => ({ toString: () => value });

    // A labelled tuple rather than an object literal: the shared config's
    // `@stylistic/object-curly-newline` explodes any 3-key object across four
    // lines and its `--fix` leaves trailing whitespace on each, which an
    // editor honouring `.editorconfig` then strips again — churn on every
    // round trip. A homogeneous table reads better one row per line anyway.
    type Row = [
        name: string,
        descriptor: ValidatorDescriptor,
        passing: unknown,
        data?: Record<string, unknown>,
    ];

    const IDENTITY: Row[] = [
        // string-format.ts — 10 sites
        ['isEmail', isEmail(), boxed('user@example.com')],
        ['isURL', isURL(), boxed('https://example.com')],
        ['isUUID', isUUID(), boxed('3f333df6-90a4-4fda-8dd3-9485d27cee36')],
        ['isIP', isIP(), boxed('192.168.0.1')],
        ['isMACAddress', isMACAddress(), boxed('01:23:45:67:89:ab')],
        ['isDate', isDate(), boxed('2020-01-01')],
        ['isISO8601', isISO8601(), boxed('2020-01-01')],
        ['isJSON', isJSON(), boxed('{"a":1}')],
        ['isBase64', isBase64(), boxed('aGVsbG8=')],
        ['isStrongPassword', isStrongPassword({ minLength: 12, minNumbers: 2 }), boxed('Aa1!aaaaaa22')],

        // type-assertions.ts — 6 sites
        ['isAlpha', isAlpha(), true],
        ['isAlphanumeric', isAlphanumeric(), 123],
        ['isNumeric', isNumeric(), 123],
        ['isDecimal', isDecimal(), 1.5],
        ['isInt', isInt({ min: 18, max: 120 }), 42],
        ['isFloat', isFloat({ min: 1, max: 9 }), 1.5],

        // length.ts — 1 site
        ['isLength', isLength({ min: 3, max: 8 }), 12345],

        // comparison.ts — 2 sites
        ['matches', matches(/^\d+$/), 123],
        ['equals (expectedValue)', equals('password', { expectedValue: '42' }), 42],
        ['equals (sibling)', equals('password'), 42, { password: 42 }],
    ];

    for (const [name, descriptor, passing, data] of IDENTITY) {
        it(`${name} hands back the original value, not the coerced probe`, () => {
            const outcome = run(descriptor, passing, data ?? {});
            expect(outcome.ok).toBe(true);
            if (!outcome.ok) return;
            // `toBe`, not `toEqual` — `Object.is(42, '42')` is false, and for
            // the boxed rows only reference identity separates the value from
            // its own stringification.
            expect(outcome.value).toBe(passing);
        });
    }

    it('keeps every identity fixture non-string, or the rows above go vacuous', () => {
        // A future edit that "simplifies" a fixture back to a plain string
        // would silently un-discriminate its row. Pin the property that makes
        // the table work rather than trusting the fixtures to stay honest.
        for (const [, , passing] of IDENTITY) {
            expect(typeof passing).not.toBe('string');
            expect(toValidatorString(passing)).not.toBe(passing);
        }
    });
});

/* ------------------------------------------------------------------ */
/* descriptor shape — observable API surface, not implementation       */
/* ------------------------------------------------------------------ */

describe('descriptor own-property shape', () => {
    it('leaves `sideEffect` ABSENT — not present-and-undefined — where no factory declares one', () => {
        // Own-property shape is observable API surface, and `.toBeUndefined()`
        // cannot see a regression in it: writing `sideEffect: undefined`
        // unconditionally still reads back as `undefined` while turning
        // `Object.keys(isEmail())` from `['run']` into `['sideEffect','run']`.
        // Inert inside validup (the container compares `item.sideEffect ===
        // true`), but it breaks `toStrictEqual` and any consumer using
        // `hasOwnProperty` to detect an EXPLICIT declaration.
        const undeclared: ValidatorDescriptor[] = [
            isEmail(),
            isURL(),
            isUUID(),
            isIP(),
            isMACAddress(),
            isDate(),
            isISO8601(),
            isJSON(),
            isBase64(),
            isAlpha(),
            isAlphanumeric(),
            isNumeric(),
            isDecimal(),
            isStrongPassword(),
            matches(/x/),
            isLength({ min: 1 }),
            isInt(),
            isFloat(),
        ];

        for (const descriptor of undeclared) {
            expect(Object.hasOwn(descriptor, 'sideEffect')).toBe(false);
            expect(Object.keys(descriptor)).toEqual(['run']);
        }
    });

    it('writes the key for `equals`, which declares one in BOTH polarities', () => {
        // `equals` is the only shipped factory that decides `sideEffect` from
        // its own arguments, so it always writes the key — including the
        // `false` branch, where the flag is a deliberate "cache me" statement
        // rather than an omission.
        expect(Object.keys(equals('password'))).toEqual(['sideEffect', 'run']);
        expect(equals('password').sideEffect).toBe(true);
        expect(Object.keys(equals('password', { expectedValue: 'x' }))).toEqual(['sideEffect', 'run']);
        expect(equals('password', { expectedValue: 'x' }).sideEffect).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/* data-payload identity                                               */
/* ------------------------------------------------------------------ */

describe('issue `data` is a fresh object per failure', () => {
    // A consumer mutating `issue.data` (an i18n layer interpolating in place,
    // a serializer stamping a field on it) must not bleed into the next
    // failure from the same descriptor. Every factory that emits `data`
    // builds it inside `run` — except `isStrongPassword`, which builds a
    // template at factory time and MUST clone it per throw. That clone is the
    // one that can silently regress, so it is asserted alongside the others.
    const withData: {
        name: string,
        descriptor: ValidatorDescriptor,
        failing: unknown
    }[] = [
        {
            name: 'isStrongPassword',
            descriptor: isStrongPassword({ minLength: 12, minNumbers: 2 }),
            failing: 'a',
        },
        {
            name: 'matches',
            descriptor: matches(/^\d+$/),
            failing: 'abc',
        },
        {
            name: 'equals',
            descriptor: equals('password', { expectedValue: 'abc' }),
            failing: 'xyz',
        },
        {
            name: 'isLength',
            descriptor: isLength({ min: 3 }),
            failing: 'ab',
        },
        {
            name: 'isInt',
            descriptor: isInt({ min: 100 }),
            failing: '5',
        },
    ];

    for (const row of withData) {
        it(`${row.name} does not share the payload reference between failures`, () => {
            const first = run(row.descriptor, row.failing);
            const second = run(row.descriptor, row.failing);
            expect(first.ok).toBe(false);
            expect(second.ok).toBe(false);
            if (first.ok || second.ok) return;
            expect(first.data).toEqual(second.data);
            expect(first.data).not.toBe(second.data);

            // …and mutating one really is invisible to the next run.
            (first.data as Record<string, unknown>).injected = true;
            const third = run(row.descriptor, row.failing);
            expect(third.ok).toBe(false);
            if (third.ok) return;
            expect(third.data).not.toHaveProperty('injected');
        });
    }

    it('leaves `data` undefined for a bare code', () => {
        const outcome = run(isEmail(), 'nope');
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.data).toBeUndefined();
    });
});

/* ------------------------------------------------------------------ */
/* when `message` is resolved                                          */
/* ------------------------------------------------------------------ */

/**
 * The package is NOT uniform here, and pretending otherwise is how a
 * false claim reached the README. Fourteen factories hoist
 * `const message = options.message ?? …` into the factory body, so the
 * override is frozen when the descriptor is built. Five read
 * `options.message` inside `run`, so a later mutation of the options bag
 * IS observed.
 *
 * Neither half is obviously the right one; both are pinned so that
 * unifying them is a deliberate, visible change. Consumers should not
 * rely on either — build a descriptor per locale instead.
 */
describe('when `message` is resolved', () => {
    // Each row hands the factory the SAME object the test later mutates —
    // no spread anywhere, or the mutation could not reach the closure and
    // the assertion would be vacuous in both directions.
    type Case = {
        name: string,
        makeBag: () => any,
        build: (bag: any) => ValidatorDescriptor,
        failing: unknown,
        fallback: string,
    };

    const MUTATED = 'MUTATED AFTER CONSTRUCTION';

    const frozen: Case[] = [
        {
            name: 'isEmail',
            makeBag: () => ({}),
            build: (bag) => isEmail(bag),
            failing: 'nope',
            fallback: 'The value is not a valid email address',
        },
        {
            name: 'isURL',
            makeBag: () => ({}),
            build: (bag) => isURL(bag),
            failing: 'not a url',
            fallback: 'The value is not a valid URL',
        },
        {
            name: 'isUUID',
            makeBag: () => ({}),
            build: (bag) => isUUID(bag),
            failing: 'nope',
            fallback: 'The value is not a valid UUID',
        },
        {
            name: 'isIP',
            makeBag: () => ({}),
            build: (bag) => isIP(bag),
            failing: 'nope',
            fallback: 'The value is not a valid IP address',
        },
        {
            name: 'isMACAddress',
            makeBag: () => ({}),
            build: (bag) => isMACAddress(bag),
            failing: 'nope',
            fallback: 'The value is not a valid MAC address',
        },
        {
            name: 'isDate',
            makeBag: () => ({}),
            build: (bag) => isDate(bag),
            failing: 'nope',
            fallback: 'The value is not a valid date',
        },
        {
            name: 'isISO8601',
            makeBag: () => ({}),
            build: (bag) => isISO8601(bag),
            failing: 'nope',
            fallback: 'The value is not a valid date',
        },
        {
            name: 'isJSON',
            makeBag: () => ({}),
            build: (bag) => isJSON(bag),
            failing: 'nope',
            fallback: 'The value is not valid JSON',
        },
        {
            name: 'isBase64',
            makeBag: () => ({}),
            build: (bag) => isBase64(bag),
            failing: '!!!',
            fallback: 'The value is not valid base64',
        },
        {
            name: 'isAlpha',
            makeBag: () => ({}),
            build: (bag) => isAlpha(bag),
            failing: 'abc123',
            fallback: 'The value is not alphabetical',
        },
        {
            name: 'isAlphanumeric',
            makeBag: () => ({}),
            build: (bag) => isAlphanumeric(bag),
            failing: 'abc-123',
            fallback: 'The value must be alphanumeric',
        },
        {
            name: 'isNumeric',
            makeBag: () => ({}),
            build: (bag) => isNumeric(bag),
            failing: 'abc',
            fallback: 'The value must be numeric',
        },
        {
            name: 'isDecimal',
            makeBag: () => ({}),
            build: (bag) => isDecimal(bag),
            failing: 'abc',
            fallback: 'The value must be a decimal number',
        },
        {
            name: 'isStrongPassword',
            makeBag: () => ({ minLength: 40 }),
            build: (bag) => isStrongPassword(bag),
            failing: 'a',
            fallback: 'The value does not meet the password strength requirements',
        },
    ];

    for (const row of frozen) {
        it(`${row.name} freezes the message at factory-call time`, () => {
            const bag = row.makeBag();
            const descriptor = row.build(bag);
            bag.message = MUTATED;

            const outcome = run(descriptor, row.failing);
            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.message).toBe(row.fallback);

            // …and the same bag populated BEFORE construction IS honoured, so
            // this is about timing rather than `message` being ignored.
            const upFront = row.makeBag();
            upFront.message = 'up front';
            expect((run(row.build(upFront), row.failing) as { message: string }).message).toBe('up front');
        });
    }

    const late: Case[] = [
        {
            name: 'matches',
            makeBag: () => ({}),
            build: (bag) => matches(/^abc$/, bag),
            failing: 'zzz',
            fallback: 'The value does not match the expected pattern',
        },
        {
            name: 'equals',
            makeBag: () => ({ expectedValue: 'abc' }),
            build: (bag) => equals('other', bag),
            failing: 'zzz',
            fallback: 'The value must equal other',
        },
        {
            name: 'isLength',
            makeBag: () => ({ min: 5 }),
            build: (bag) => isLength(bag),
            failing: 'ab',
            fallback: 'The minimum length allowed is 5',
        },
        {
            name: 'isInt',
            makeBag: () => ({ min: 100 }),
            build: (bag) => isInt(bag),
            failing: '5',
            fallback: 'The value must be greater than or equal to 100',
        },
        {
            name: 'isFloat',
            makeBag: () => ({ min: 100 }),
            build: (bag) => isFloat(bag),
            failing: '5.5',
            fallback: 'The value must be greater than or equal to 100',
        },
    ];

    for (const row of late) {
        it(`${row.name} re-reads the message on every run`, () => {
            const bag = row.makeBag();
            const descriptor = row.build(bag);

            const before = run(descriptor, row.failing);
            expect(before.ok).toBe(false);
            if (before.ok) return;
            expect(before.message).toBe(row.fallback);

            bag.message = MUTATED;
            const after = run(descriptor, row.failing);
            expect(after.ok).toBe(false);
            if (after.ok) return;
            expect(after.message).toBe(MUTATED);
        });
    }
});

/* ------------------------------------------------------------------ */
/* pipeline factories: type-failure vs range-failure                   */
/* ------------------------------------------------------------------ */

describe('the pipeline factories split type-failure from range-failure', () => {
    it('isLength keeps four outcome triples from one boolean', () => {
        expect(run(isLength({ min: 2, max: 5 }), 'a')).toMatchObject({
            code: IssueCode.MIN_LENGTH,
            data: { min: 2 },
        });
        expect(run(isLength({ min: 2, max: 5 }), 'abcdef')).toMatchObject({
            code: IssueCode.MAX_LENGTH,
            data: { max: 5 },
        });
        // Degenerate fallbacks: `validator.isLength` counts surrogate pairs,
        // the bound check compares UTF-16 code units, so '👍' fails the
        // validator while `'👍'.length === 2` clears `min`.
        expect(run(isLength({ min: 2 }), '👍')).toMatchObject({
            code: IssueCode.MIN_LENGTH,
            message: 'The value has an invalid length',
        });
        // `discreteLengths` fails with neither bound crossed → generic code.
        // (No cast needed — it is a documented `validator.IsLengthOptions` key.
        // The full fallback table lives in `factories.spec.ts`.)
        expect(run(isLength({ discreteLengths: [2, 5] }), 'abc')).toMatchObject({ code: IssueCode.VALUE_INVALID });
    });
});

/* ------------------------------------------------------------------ */
/* type-level: the core's per-code data gatekeep, from the adapter     */
/* ------------------------------------------------------------------ */

// Every factory builds its failure through the core's `createValidupError`,
// whose per-code `data` contract (`CreateValidupErrorTail`) is what stops a
// factory from emitting `MIN_LENGTH` without a `min`. The negative direction
// is not otherwise exercised: `src/` only ever passes CORRECT payloads, so
// `build:types` proves the contract is satisfiable, never that it bites.
//
// THIS BLOCK IS TYPECHECKED. `packages/validator-js/tsconfig.json` includes
// `test/**/*.ts`, so `npm run test:types` (`tsc --noEmit`) covers this file.
// (`tsconfig.build.json` is deliberately src-only, so specs never influence
// the published declarations.) Verified non-vacuous — see
// `.agents/testing.md`.
describe('type-level: the core per-code data gatekeep, seen from the adapter', () => {
    it('accepts the correct payloads the factories actually emit', () => {
        // Runtime assertions so this `it()` can fail for a reason vitest sees
        // rather than resting entirely on `tsc`.
        const parameterized = createValidupError('a', IssueCode.MIN_LENGTH, 'too short', { min: 1 });
        expect(isValidupError(parameterized)).toBe(true);
        expect((parameterized.issues[0] as any).data).toEqual({ min: 1 });

        const bare = createValidupError('a', IssueCode.EMAIL, 'bad email');
        expect((bare.issues[0] as any).data).toBeUndefined();
    });

    it('rejects the negative cases at compile time', () => {
        // Pure type assertions — `tsc` is the judge. The runtime body is
        // intentionally inert; each call is a compile-time probe.
        const probe = () => {
            // @ts-expect-error parameterized code requires `data`
            createValidupError('x', IssueCode.PATTERN, 'x');
            // @ts-expect-error a bare code accepts no `data`
            createValidupError('x', IssueCode.EMAIL, 'x', { nope: 1 });
            // @ts-expect-error `pointsPerUnique` is a scoring weight, not a strength requirement
            createValidupError('x', IssueCode.STRONG_PASSWORD, 'x', { pointsPerUnique: 5 });
            // @ts-expect-error `pattern` must be a string, not a RegExp
            createValidupError('x', IssueCode.PATTERN, 'x', { pattern: /re/ });
        };

        expect(typeof probe).toBe('function');
    });
});
