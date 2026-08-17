/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { describe, expect, it } from 'vitest';
import { IssueCode, flattenIssueItems } from '@ebec/core';
import {
    Container,
    ValidupError,
} from 'validup';
import { createValidator } from '../../src';

describe('createValidator', () => {
    // The generic wrap for validator.js functions we don't pre-bake. The
    // contract: stringify ctx.value, call the predicate, throw a
    // ValidupError carrying the supplied code/data on failure.

    it('lifts a validator.js predicate into a validup Validator', async () => {
        const container = new Container<{ card: string }>();
        container.mount('card', createValidator(validator.isCreditCard, {
            code: 'credit_card',
            message: 'Invalid credit card number',
        }));

        expect.assertions(3);
        try {
            await container.run({ card: 'not-a-card' });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                expect(items).toHaveLength(1);
                expect(items[0]?.code).toBe('credit_card');
                expect(items[0]?.message).toBe('Invalid credit card number');
            }
        }
    });

    it('passes valid values through unchanged', async () => {
        const container = new Container<{ card: string }>();
        container.mount('card', createValidator(validator.isCreditCard, {
            code: 'credit_card',
            message: 'Invalid credit card number',
        }));
        // Test card number — Visa.
        const out = await container.run({ card: '4111111111111111' });
        expect(out.card).toBe('4111111111111111');
    });

    it('hands back the original value, not the coerced probe', async () => {
        // The test above passes a string card number, where
        // `ctx.value === toValidatorString(ctx.value)` — so it cannot tell
        // `return ctx.value` from `return stringified`. This is the twentieth
        // instance of the site that `issue-shape.spec.ts`'s identity table
        // pins for the nineteen pre-baked ones; the escape hatch has the same
        // contract and the same silent-retype failure mode. Feed a number,
        // whose stringification is a DIFFERENT value, and it bites.
        const container = new Container<{ pin: number }>();
        container.mount('pin', createValidator(validator.isNumeric, { code: 'numeric' }));

        const out = await container.run({ pin: 1234 });
        expect(out.pin).toBe(1234);
        expect(typeof out.pin).toBe('number');
    });

    it('forwards data onto the resulting IssueItem', async () => {
        expect.assertions(1);
        const container = new Container<{ phone: string }>();
        container.mount('phone', createValidator(
            (v: string) => validator.isMobilePhone(v, 'de-DE'),
            {
                code: 'mobile_phone',
                data: { locale: 'de-DE' },
                message: 'Invalid German mobile number',
            },
        ));

        try {
            await container.run({ phone: '12345' });
            throw new Error('expected ValidupError');
        } catch (e) {
            if (!(e instanceof ValidupError)) throw e;
            const items = flattenIssueItems(e.issues);
            expect(items[0]?.data).toEqual({ locale: 'de-DE' });
        }
    });

    it('defaults the message when none is supplied', async () => {
        // Unlike the pre-baked factories — each of which carries its own
        // English default matching `@ilingo/validup`'s `en` catalog — the
        // generic wrap has no vocabulary to draw wording from, so it falls
        // back to a single generic string. `message` is optional on
        // `CreateValidatorOptions`, so this is a supported call shape rather
        // than a defensive branch.
        expect.assertions(2);
        const container = new Container<{ card: string }>();
        container.mount('card', createValidator(validator.isCreditCard, { code: 'credit_card' }));
        try {
            await container.run({ card: 'not-a-card' });
            throw new Error('expected ValidupError');
        } catch (e) {
            if (!(e instanceof ValidupError)) throw e;
            const items = flattenIssueItems(e.issues);
            expect(items[0]?.code).toBe('credit_card');
            expect(items[0]?.message).toBe('The value is invalid');
        }
    });

    it('surfaces the sideEffect opt-in on the descriptor', () => {
        // The generic wrap is the one place in the package where `sideEffect`
        // is a caller-supplied option rather than a decision the factory makes
        // from its own arguments — a wrapped predicate that captures external
        // state has to be able to say so. Unlike the pre-baked factories,
        // `createValidator` writes the key unconditionally, so an omitted flag
        // is present-and-undefined here (its effect is identical: the
        // container only skips the cache on `=== true`).
        const declared = createValidator((value) => value === 'ok', {
            code: 'custom_code',
            message: 'nope',
            sideEffect: true,
        });
        expect(declared.sideEffect).toBe(true);

        const undeclared = createValidator((value) => value === 'ok', { code: 'custom_code' });
        expect(undeclared.sideEffect).toBeUndefined();
        expect(Object.hasOwn(undeclared, 'sideEffect')).toBe(true);
    });

    it('defaults to VALUE_INVALID when no code is supplied', async () => {
        // The factory signature requires `code`, but a runtime caller
        // might pass an empty string. Defensive default.
        expect.assertions(1);
        const container = new Container<{ x: string }>();
        container.mount('x', createValidator(validator.isAlpha, {
            code: '',
            message: 'Bad value',
        }));
        try {
            await container.run({ x: '123' });
            throw new Error('expected ValidupError');
        } catch (e) {
            if (!(e instanceof ValidupError)) throw e;
            const items = flattenIssueItems(e.issues);
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
        }
    });
});
