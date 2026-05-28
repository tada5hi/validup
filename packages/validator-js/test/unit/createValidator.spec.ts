/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { describe, expect, it } from 'vitest';
import {
    Container,
    IssueCode,
    ValidupError,
    flattenIssueItems,
} from 'validup';
import { createValidator } from '../../src';

describe('createValidator', () => {
    // The generic wrap for validator.js functions we don't pre-bake. The
    // contract: stringify ctx.value, call the predicate, throw a
    // ValidupError carrying the supplied code/params on failure.

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

    it('forwards params onto the resulting IssueItem', async () => {
        expect.assertions(1);
        const container = new Container<{ phone: string }>();
        container.mount('phone', createValidator(
            (v: string) => validator.isMobilePhone(v, 'de-DE'),
            {
                code: 'mobile_phone',
                params: { locale: 'de-DE' },
                message: 'Invalid German mobile number',
            },
        ));

        try {
            await container.run({ phone: '12345' });
            throw new Error('expected ValidupError');
        } catch (e) {
            if (!(e instanceof ValidupError)) throw e;
            const items = flattenIssueItems(e.issues);
            expect(items[0]?.params).toEqual({ locale: 'de-DE' });
        }
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
