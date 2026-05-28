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
import type { Validator } from 'validup';
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
// ValidupError on failure. The tests assert the failure (code + params)
// via `flattenIssueItems` and the success (value passes through).
async function fail(validator: Validator, value: unknown): Promise<ReturnType<typeof flattenIssueItems>> {
    try {
        await validator({
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

async function pass(validator: Validator, value: unknown): Promise<unknown> {
    return validator({
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
        expect(items[0]?.params).toMatchObject({ minLength: 12, minNumbers: 2 });
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

    it('omits returnScore from the params payload', async () => {
        // returnScore is a validator.js execution mode, not a strength
        // requirement — an i18n template would never want to render it.
        const items = await fail(
            isStrongPassword({ minLength: 12, returnScore: true }),
            'short',
        );
        expect(items[0]?.params).not.toHaveProperty('returnScore');
        expect(items[0]?.params).toMatchObject({ minLength: 12 });
    });

    it('projects params down to the documented requirement keys', async () => {
        // Regression: scoring weights (`pointsPerUnique`,
        // `pointsForContainingLower`, …) are valid `StrongPasswordOptions`
        // keys but not part of the documented STRONG_PASSWORD vocabulary
        // contract. They must still influence the pass/fail decision but
        // must NOT leak into the IssueItem.params payload (i18n templates
        // would render gibberish).
        const items = await fail(
            isStrongPassword({
                minLength: 12,
                pointsPerUnique: 5,
                pointsForContainingLower: 1,
            }),
            'short',
        );
        expect(items[0]?.params).toEqual({ minLength: 12 });
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
        expect(items[0]?.params).toEqual({ min: 18 });
    });
    it('emits IssueCode.MAX_VALUE when above max', async () => {
        const items = await fail(isInt({ max: 120 }), 999);
        expect(items[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect(items[0]?.params).toEqual({ max: 120 });
    });
    it('accepts valid integers in range', async () => {
        expect(await pass(isInt({ min: 18, max: 120 }), 42)).toBe(42);
    });

    it('emits IssueCode.MIN_VALUE for the strict gt boundary (params.min = gt)', async () => {
        // Regression: pre-fix, value == options.gt fell through the explicit
        // `<` check (since gt is exclusive) and surfaced as INTEGER from the
        // defensive final-pass. It's a range failure — should be MIN_VALUE.
        const items = await fail(isInt({ gt: 10 }), 10);
        expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
        expect(items[0]?.params).toEqual({ min: 10 });
    });

    it('emits IssueCode.MAX_VALUE for the strict lt boundary (params.max = lt)', async () => {
        const items = await fail(isInt({ lt: 10 }), 10);
        expect(items[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect(items[0]?.params).toEqual({ max: 10 });
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
        expect(onGt[0]?.params).toEqual({ min: 1.5 });

        const onLt = await fail(isFloat({ lt: 10 }), 10);
        expect(onLt[0]?.code).toBe(IssueCode.MAX_VALUE);
        expect(onLt[0]?.params).toEqual({ max: 10 });
    });
});

describe('isLength', () => {
    it('emits IssueCode.MIN_LENGTH when too short', async () => {
        const items = await fail(isLength({ min: 3 }), 'hi');
        expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
        expect(items[0]?.params).toEqual({ min: 3 });
    });
    it('emits IssueCode.MAX_LENGTH when too long', async () => {
        const items = await fail(isLength({ max: 3 }), 'toolong');
        expect(items[0]?.code).toBe(IssueCode.MAX_LENGTH);
        expect(items[0]?.params).toEqual({ max: 3 });
    });
    it('accepts values inside the range', async () => {
        expect(await pass(isLength({ min: 3, max: 10 }), 'hello')).toBe('hello');
    });
});

describe('matches', () => {
    it('emits IssueCode.PATTERN with { pattern: string }', async () => {
        const items = await fail(matches(/^[a-z]+$/), 'UPPER');
        expect(items[0]?.code).toBe(IssueCode.PATTERN);
        expect(items[0]?.params).toEqual({ pattern: '^[a-z]+$' });
    });
});

describe('equals', () => {
    it('emits IssueCode.SAME_AS with { other }', async () => {
        const items = await fail(equals('password'), 'mismatch');
        expect(items[0]?.code).toBe(IssueCode.SAME_AS);
        expect(items[0]?.params).toEqual({ other: 'password' });
    });
    it('uses expectedValue for runtime comparison when supplied', async () => {
        expect(await pass(equals('password', { expectedValue: 'hunter2' }), 'hunter2')).toBe('hunter2');
    });
});
