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
    flattenIssueItems,
} from 'validup';
import type { ValidatorDescriptor } from 'validup';
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

// Helper — every factory wraps the validator.js call and throws a
// ValidupError on failure. The tests assert the failure (code + data)
// via `flattenIssueItems` and the success (value passes through).
async function fail(descriptor: ValidatorDescriptor, value: unknown): Promise<ReturnType<typeof flattenIssueItems>> {
    try {
        await descriptor.run({
            key: '',
            path: [],
            value,
            data: {},
            context: undefined,
        });
    } catch (e) {
        if (e instanceof ValidupError) return flattenIssueItems(e.issues);
    }
    throw new Error('expected validator to throw');
}

async function pass(descriptor: ValidatorDescriptor, value: unknown): Promise<unknown> {
    return descriptor.run({
        key: '',
        path: [],
        value,
        data: {},
        context: undefined,
    });
}

describe('isEmail', () => {
    it('rejects non-emails with IssueCode.EMAIL', async () => {
        const items = await fail(isEmail(), 'not-an-email');
        expect(items[0]?.code).toBe(IssueCode.EMAIL);
    });
    it('accepts valid emails', async () => {
        expect(await pass(isEmail(), 'peter@example.com')).toBe('peter@example.com');
    });
    it('honours the message override', async () => {
        const items = await fail(isEmail({ message: 'Bad email' }), 'x');
        expect(items[0]?.message).toBe('Bad email');
    });
});

describe('isURL', () => {
    it('rejects non-URLs with IssueCode.URL', async () => {
        const items = await fail(isURL(), 'not a url');
        expect(items[0]?.code).toBe(IssueCode.URL);
    });
    it('accepts valid URLs', async () => {
        expect(await pass(isURL(), 'https://example.com')).toBe('https://example.com');
    });
});

describe('isUUID', () => {
    it('rejects non-UUIDs with IssueCode.UUID', async () => {
        const items = await fail(isUUID(), 'not-a-uuid');
        expect(items[0]?.code).toBe(IssueCode.UUID);
    });
    it('accepts valid v4 UUIDs', async () => {
        const v4 = '123e4567-e89b-42d3-a456-426614174000';
        expect(await pass(isUUID({ version: 4 }), v4)).toBe(v4);
    });
});

describe('isIP', () => {
    it('rejects non-IPs with IssueCode.IP_ADDRESS', async () => {
        const items = await fail(isIP(), 'not-an-ip');
        expect(items[0]?.code).toBe(IssueCode.IP_ADDRESS);
    });
    it('accepts IPv4', async () => {
        expect(await pass(isIP(), '192.168.0.1')).toBe('192.168.0.1');
    });
});

describe('isMACAddress', () => {
    it('rejects bad MACs with IssueCode.MAC_ADDRESS', async () => {
        const items = await fail(isMACAddress(), 'not-a-mac');
        expect(items[0]?.code).toBe(IssueCode.MAC_ADDRESS);
    });
    it('accepts standard MACs', async () => {
        expect(await pass(isMACAddress(), '01:23:45:67:89:ab')).toBe('01:23:45:67:89:ab');
    });
});

describe('isDate / isISO8601', () => {
    it('isDate rejects non-dates with IssueCode.DATE', async () => {
        const items = await fail(isDate(), 'not-a-date');
        expect(items[0]?.code).toBe(IssueCode.DATE);
    });
    it('isISO8601 rejects non-ISO with IssueCode.DATE (shared code)', async () => {
        const items = await fail(isISO8601(), 'not-iso');
        expect(items[0]?.code).toBe(IssueCode.DATE);
    });
});

describe('isJSON', () => {
    it('rejects non-JSON with IssueCode.JSON', async () => {
        const items = await fail(isJSON(), 'not { json }');
        expect(items[0]?.code).toBe(IssueCode.JSON);
    });
    it('accepts valid JSON', async () => {
        const json = '{"a":1}';
        expect(await pass(isJSON(), json)).toBe(json);
    });
});

describe('isBase64', () => {
    it('rejects non-base64 with IssueCode.BASE64', async () => {
        const items = await fail(isBase64(), 'not base64!');
        expect(items[0]?.code).toBe(IssueCode.BASE64);
    });
});

describe('isStrongPassword', () => {
    it('rejects weak passwords with IssueCode.STRONG_PASSWORD', async () => {
        const items = await fail(isStrongPassword({ minLength: 12, minNumbers: 2 }), 'short');
        expect(items[0]?.code).toBe(IssueCode.STRONG_PASSWORD);
        expect(items[0]?.data).toMatchObject({ minLength: 12, minNumbers: 2 });
    });

    it('rejects weak passwords even when consumer sets returnScore: true', async () => {
        // Regression guard: validator.isStrongPassword(..., { returnScore: true })
        // returns a numeric score rather than a boolean. A naive truthy check
        // would accept any non-zero score as a pass — the factory strips the
        // flag before forwarding to validator.js so a weak password still
        // surfaces as a STRONG_PASSWORD failure.
        const items = await fail(
            isStrongPassword({ minLength: 12, returnScore: true }),
            'short',
        );
        expect(items[0]?.code).toBe(IssueCode.STRONG_PASSWORD);
    });

    it('omits returnScore from the data payload', async () => {
        // returnScore is a validator.js execution mode, not a strength
        // requirement — an i18n template would never want to render it.
        const items = await fail(
            isStrongPassword({ minLength: 12, returnScore: true }),
            'short',
        );
        expect(items[0]?.data).not.toHaveProperty('returnScore');
        expect(items[0]?.data).toMatchObject({ minLength: 12 });
    });

    it('projects data down to the documented requirement keys', async () => {
        // Regression: scoring weights (`pointsPerUnique`,
        // `pointsForContainingLower`, …) are valid `StrongPasswordOptions`
        // keys but not part of the documented STRONG_PASSWORD vocabulary
        // contract. They must still influence the pass/fail decision but
        // must NOT leak into the IssueItem.data payload (i18n templates
        // would render gibberish).
        const items = await fail(
            isStrongPassword({
                minLength: 12,
                pointsPerUnique: 5,
                pointsForContainingLower: 1,
            }),
            'short',
        );
        expect(items[0]?.data).toEqual({ minLength: 12 });
    });
});

describe('isAlpha / isAlphanumeric / isNumeric / isDecimal', () => {
    it('isAlpha emits IssueCode.ALPHA', async () => {
        const items = await fail(isAlpha(), '123');
        expect(items[0]?.code).toBe(IssueCode.ALPHA);
    });
    it('isAlphanumeric emits IssueCode.ALPHA_NUM', async () => {
        const items = await fail(isAlphanumeric(), 'has-dash');
        expect(items[0]?.code).toBe(IssueCode.ALPHA_NUM);
    });
    it('isNumeric emits IssueCode.NUMERIC', async () => {
        const items = await fail(isNumeric(), 'abc');
        expect(items[0]?.code).toBe(IssueCode.NUMERIC);
    });
    it('isDecimal emits IssueCode.DECIMAL', async () => {
        const items = await fail(isDecimal(), 'abc');
        expect(items[0]?.code).toBe(IssueCode.DECIMAL);
    });
});

describe('isInt', () => {
    it('emits IssueCode.INTEGER when value isn\'t an integer', async () => {
        const items = await fail(isInt(), 'abc');
        expect(items[0]?.code).toBe(IssueCode.INTEGER);
    });
    it('emits IssueCode.MIN_VALUE when below min', async () => {
        const items = await fail(isInt({ min: 18 }), 5);
        expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect(items[0]?.data).toEqual({ min: 18 });
    });
    it('emits IssueCode.MAX_VALUE when above max', async () => {
        const items = await fail(isInt({ max: 120 }), 999);
        expect(items[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect(items[0]?.data).toEqual({ max: 120 });
    });
    it('accepts valid integers in range', async () => {
        expect(await pass(isInt({ min: 18, max: 120 }), 42)).toBe(42);
    });

    it('emits IssueCode.MIN_VALUE for the strict gt boundary (data.min = gt)', async () => {
        // Regression: pre-fix, value == options.gt fell through the explicit
        // `<` check (since gt is exclusive) and surfaced as INTEGER from the
        // defensive final-pass. It's a range failure — should be MIN_VALUE.
        const items = await fail(isInt({ gt: 10 }), 10);
        expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect(items[0]?.data).toEqual({ min: 10 });
    });

    it('emits IssueCode.MAX_VALUE for the strict lt boundary (data.max = lt)', async () => {
        const items = await fail(isInt({ lt: 10 }), 10);
        expect(items[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect(items[0]?.data).toEqual({ max: 10 });
    });

    it('uses the shared range-ladder default messages', async () => {
        // `isInt` and `isFloat` share one `assertNumericRange` helper, so the
        // wording is a single contract — assert it on both factories.
        expect((await fail(isInt({ min: 18 }), 5))[0]?.message)
            .toBe('The value must be greater than or equal to 18');
        expect((await fail(isInt({ gt: 10 }), 10))[0]?.message)
            .toBe('The value must be greater than 10');
        expect((await fail(isInt({ max: 120 }), 999))[0]?.message)
            .toBe('The value must be less than or equal to 120');
        expect((await fail(isInt({ lt: 10 }), 10))[0]?.message)
            .toBe('The value must be less than 10');
    });

    it('lets options.message override every range failure', async () => {
        expect((await fail(isInt({ min: 18, message: 'Too young' }), 5))[0]?.message)
            .toBe('Too young');
    });

    it('lets options.message override the TYPE failure too', async () => {
        // Separate throw site from the range ladder. `issue-shape.spec.ts`'s
        // message-override loop only covers the single-triple factories, so a
        // dropped `options.message ??` here would otherwise go unnoticed.
        expect((await fail(isInt({ message: 'Not a whole number' }), 'abc'))[0]?.message)
            .toBe('Not a whole number');
    });

    it('the defensive re-check catches bounds the ladder cannot express', async () => {
        // The second `validator.isInt(s, options)` call is NOT dead code.
        // `NaN` and `Infinity` are ordinary `number`s, so `{ min: Number.NaN }`
        // type-checks clean under `--strict` with no cast — yet every
        // comparison in `assertNumericRange` against NaN is false, so the
        // ladder cannot classify it. validator.js's own `str >= options.min`
        // is false as well, so the full-bag re-check rejects and we report
        // INTEGER ("no usable bound") rather than passing the value through.
        for (const bound of ['min', 'max', 'lt', 'gt'] as const) {
            const items = await fail(isInt({ [bound]: Number.NaN }), '5');
            expect(items[0]?.code).toBe(IssueCode.INTEGER);
            expect(items[0]?.data).toBeUndefined();
        }
        // Honours the message override at this throw site as well.
        expect((await fail(isInt({ min: Number.NaN, message: 'unusable bound' }), '5'))[0]?.message)
            .toBe('unusable bound');
    });

    it('a finite bound is always classified by the ladder, never by the re-check', async () => {
        // The counterfactual to the case above: for every ordinary bound the
        // ladder and validator.js agree, so the range codes — not INTEGER —
        // are what a consumer sees. If the ladder were removed, these would
        // all collapse onto INTEGER via the defensive pass.
        expect((await fail(isInt({ min: 100 }), '5'))[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect((await fail(isInt({ max: 1 }), '5'))[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect((await fail(isInt({ gt: 100 }), '5'))[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect((await fail(isInt({ lt: 1 }), '5'))[0]?.code).toBe(IssueCode.MAX_VALUE);
    });
});

describe('isFloat', () => {
    it('emits IssueCode.DECIMAL when value isn\'t a number', async () => {
        const items = await fail(isFloat(), 'abc');
        expect(items[0]?.code).toBe(IssueCode.DECIMAL);
    });
    it('emits IssueCode.MIN_VALUE / MAX_VALUE for range failures', async () => {
        const low = await fail(isFloat({ min: 1 }), 0.5);
        expect(low[0]?.code).toBe(IssueCode.MIN_VALUE);
        const high = await fail(isFloat({ max: 10 }), 11.5);
        expect(high[0]?.code).toBe(IssueCode.MAX_VALUE);
    });
    it('emits IssueCode.MIN_VALUE / MAX_VALUE for strict gt / lt boundaries', async () => {
        const onGt = await fail(isFloat({ gt: 1.5 }), 1.5);
        expect(onGt[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect(onGt[0]?.data).toEqual({ min: 1.5 });

        const onLt = await fail(isFloat({ lt: 10 }), 10);
        expect(onLt[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect(onLt[0]?.data).toEqual({ max: 10 });
    });

    it('uses the shared range-ladder default messages', async () => {
        expect((await fail(isFloat({ min: 1 }), 0.5))[0]?.message)
            .toBe('The value must be greater than or equal to 1');
        expect((await fail(isFloat({ gt: 1.5 }), 1.5))[0]?.message)
            .toBe('The value must be greater than 1.5');
        expect((await fail(isFloat({ max: 10 }), 11.5))[0]?.message)
            .toBe('The value must be less than or equal to 10');
        expect((await fail(isFloat({ lt: 10 }), 10))[0]?.message)
            .toBe('The value must be less than 10');
    });

    it('honours options.message on the TYPE gate', async () => {
        // The un-localized pre-check is a THIRD throw site, distinct from the
        // range ladder and from the localized downgrade covered further down.
        // Dropping `options.message ??` here left the suite green before this
        // row existed.
        expect((await fail(isFloat({ message: 'Not a decimal' }), 'abc'))[0]?.message)
            .toBe('Not a decimal');
    });

    it('checks bounds first-match-wins in min / gt / max / lt order', async () => {
        // 2 violates BOTH bounds — it is below min (5) and not below lt (1) —
        // so the two branches genuinely compete and the emitted code is decided
        // purely by ladder order. Reordering `assertNumericRange` flips this to
        // MAX_VALUE / { max: 1 }, which is what makes this a real ordering test.
        const items = await fail(isFloat({ min: 5, lt: 1 }), 2);
        expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect(items[0]?.data).toEqual({ min: 5 });
    });

    it('skips the range ladder for localized input that Number() cannot parse', async () => {
        // A de-DE float passes its bounds check by falling through to
        // validator.isFloat. Note this asserts the OUTCOME only: the
        // `Number.isNaN` guard at isFloat's call site is defensive, not
        // observable — every ladder comparison against NaN is already false,
        // so no test can distinguish the guard's presence.
        expect(await pass(isFloat({ locale: 'de-DE', min: 100 }), '123,45')).toBe('123,45');
    });

    it('downgrades a localized range failure to DECIMAL (documented trade-off)', async () => {
        // The other half of the locale caveat, and the ONLY path that reaches
        // isFloat's final `validator.isFloat(s, options)` re-check.
        //
        // '123,45' under de-DE is 123.45, which is below min: 200 — a RANGE
        // failure. But `Number('123,45')` is NaN, so the explicit ladder is
        // skipped and the failure is caught by validator.js's own locale-aware
        // bounds check, which reports only a boolean. The factory cannot tell
        // which bound was crossed at that point, so the issue surfaces as
        // DECIMAL rather than MIN_VALUE.
        //
        // This is a KNOWN trade-off documented on `isFloat`'s JSDoc, not a
        // behaviour to preserve for its own sake. It is pinned here so a fix
        // (e.g. locale-aware parsing before the ladder) is a deliberate,
        // visible change rather than a silent one. The sibling case above
        // (min: 100, which passes) exercised the same skip without ever
        // reaching this branch.
        const items = await fail(isFloat({ locale: 'de-DE', min: 200 }), '123,45');
        expect(items[0]?.code).toBe(IssueCode.DECIMAL);
        expect(items[0]?.message).toBe('The value must be a decimal number');
        // Note what is NOT here: `data: { min: 200 }`. An i18n catalog keyed on
        // DECIMAL has no bound to render.
        expect(items[0]?.data).toBeUndefined();
    });

    it('honours the message override on the localized downgrade', async () => {
        const items = await fail(
            isFloat({
                locale: 'de-DE',
                min: 200,
                message: 'Out of range',
            }),
            '123,45',
        );
        expect(items[0]?.message).toBe('Out of range');
    });
});

describe('isLength', () => {
    it('emits IssueCode.MIN_LENGTH when too short', async () => {
        const items = await fail(isLength({ min: 3 }), 'hi');
        expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
        expect(items[0]?.data).toEqual({ min: 3 });
    });
    it('emits IssueCode.MAX_LENGTH when too long', async () => {
        const items = await fail(isLength({ max: 3 }), 'toolong');
        expect(items[0]?.code).toBe(IssueCode.MAX_LENGTH);
        expect(items[0]?.data).toEqual({ max: 3 });
    });
    it('accepts values inside the range', async () => {
        expect(await pass(isLength({ min: 3, max: 10 }), 'hello')).toBe('hello');
    });

    it('honours options.message on the PRIMARY min / max bounds', async () => {
        // `isLength` is a pipeline factory, so it is excluded from
        // `issue-shape.spec.ts`'s message-override loop. Without these two
        // rows only the degenerate fallbacks below were covered, and dropping
        // `options.message ??` from either primary branch left the whole
        // suite green.
        expect((await fail(isLength({ min: 3, message: 'Too short' }), 'ab'))[0]?.message)
            .toBe('Too short');
        expect((await fail(isLength({ max: 3, message: 'Too long' }), 'toolong'))[0]?.message)
            .toBe('Too long');
    });

    describe('degenerate fallbacks (isLength returned false, no bound crossed)', () => {
        // `validator.isLength` can reject a value WITHOUT either declared bound
        // being crossed. The factory then has no bound to put in `data`, so it
        // falls back to a generic message — and, when `min` is present, to a
        // MIN_LENGTH code carrying the declared (uncrossed) bound.
        //
        // NOTE ON THE REPRO: "call without min and max" does NOT reach these
        // branches — `validator.isLength(s, {})` defaults `min` to 0 and
        // therefore always returns true. The two routes that actually reach
        // them are surrogate pairs and `discreteLengths`, both below.
        //
        // `discreteLengths` needs no cast: it is a documented member of
        // `validator.IsLengthOptions`, so this is a type-legal call shape a
        // real consumer can write.

        it('emits MIN_LENGTH with a generic message for a surrogate-pair miscount', async () => {
            // '👍'.length is 2 (UTF-16 code units) so the `s.length < min`
            // guard does NOT fire, but `validator.isLength` counts code points
            // and sees 1 — so it rejects. This is reachable on ordinary
            // astral-plane input (emoji, many CJK extensions): a user typing a
            // single emoji into a `min: 2` field gets the generic wording.
            const items = await fail(isLength({ min: 2 }), '👍');
            expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
            expect(items[0]?.message).toBe('The value has an invalid length');
            // The bound IS carried even though it was never crossed, because
            // MIN_LENGTH's vocabulary contract requires `data.min`.
            expect(items[0]?.data).toEqual({ min: 2 });
        });

        it('emits VALUE_INVALID when discreteLengths fails with no min declared', async () => {
            // 7 is not in [5, 10] → rejected. No `min` / `max` to report, and
            // MIN_LENGTH / MAX_LENGTH both REQUIRE their bound in `data`, so
            // the only contract-honouring code left is the generic one.
            const items = await fail(isLength({ discreteLengths: [5, 10] }), 'abcdefg');
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
            expect(items[0]?.message).toBe('The value has an invalid length');
            expect(items[0]?.data).toBeUndefined();
        });

        it('prefers MIN_LENGTH over VALUE_INVALID when a min is declared alongside discreteLengths', async () => {
            // 7 clears `min: 1` but is still not in [5, 10]. The declared bound
            // wins the code even though it is not the bound that failed —
            // arguably misleading, and pinned so that a later correction is a
            // deliberate change.
            const items = await fail(isLength({ min: 1, discreteLengths: [5, 10] }), 'abcdefg');
            expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
            expect(items[0]?.data).toEqual({ min: 1 });
        });

        it('honours the message override on both fallbacks', async () => {
            expect((await fail(isLength({ min: 2, message: 'Bad length' }), '👍'))[0]?.message)
                .toBe('Bad length');
            expect((await fail(isLength({ discreteLengths: [5], message: 'Bad length' }), 'abc'))[0]?.message)
                .toBe('Bad length');
        });

        it('still accepts a value matching one of the discrete lengths', async () => {
            expect(await pass(isLength({ discreteLengths: [5, 10] }), 'abcde')).toBe('abcde');
        });
    });
});

describe('matches', () => {
    it('emits IssueCode.PATTERN with { pattern: string }', async () => {
        const items = await fail(matches(/^[a-z]+$/), 'UPPER');
        expect(items[0]?.code).toBe(IssueCode.PATTERN);
        expect(items[0]?.data).toEqual({ pattern: '^[a-z]+$' });
    });
});

describe('equals', () => {
    it('emits IssueCode.SAME_AS with { other }', async () => {
        const items = await fail(equals('password'), 'mismatch');
        expect(items[0]?.code).toBe(IssueCode.SAME_AS);
        expect(items[0]?.data).toEqual({ other: 'password' });
    });
    it('uses expectedValue for runtime comparison when supplied', async () => {
        expect(await pass(equals('password', { expectedValue: 'hunter2' }), 'hunter2')).toBe('hunter2');
    });
    it('reads the comparison target from ctx.data at the key path', async () => {
        const result = await equals('password').run({
            key: 'passwordConfirm',
            path: ['passwordConfirm'],
            value: 'hunter2',
            data: { password: 'hunter2', passwordConfirm: 'hunter2' },
            context: undefined,
        });
        expect(result).toBe('hunter2');
    });
    it('fails when ctx.data target differs from ctx.value', async () => {
        try {
            await equals('password').run({
                key: 'passwordConfirm',
                path: ['passwordConfirm'],
                value: 'hunter2',
                data: { password: 'other', passwordConfirm: 'hunter2' },
                context: undefined,
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                expect(items[0]?.code).toBe(IssueCode.SAME_AS);
                expect(items[0]?.data).toEqual({ other: 'password' });
                return;
            }
        }
        throw new Error('expected validator to throw');
    });
    it('stamps sideEffect=true when reading from ctx.data (no expectedValue)', () => {
        expect(equals('password').sideEffect).toBe(true);
    });
    it('stamps sideEffect=false when expectedValue is provided', () => {
        expect(equals('password', { expectedValue: 'hunter2' }).sideEffect).toBe(false);
    });
});
