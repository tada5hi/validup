/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { IssueCode, createValidupError, defineValidator } from 'validup';
import type { ValidatorDescriptor } from 'validup';
import type { BaseFactoryOptions } from '../module';
import { toValidatorString } from '../module';

/**
 * Factory: validator.js `isLength`. Detects which bound failed at
 * validation time so the resulting issue carries a useful vocabulary
 * code:
 *
 * - Too short → `IssueCode.MIN_LENGTH` (data: `{ min }`).
 * - Too long → `IssueCode.MAX_LENGTH` (data: `{ max }`).
 *
 * Calling without `min` / `max` is allowed but degenerate — every value
 * passes. `message` overrides the default English string for both bound
 * failures.
 */
export function isLength<C = unknown>(
    options: BaseFactoryOptions & validator.IsLengthOptions = {},
): ValidatorDescriptor<C> {
    const { min, max } = options;
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isLength(s, options)) return ctx.value;
            if (typeof min === 'number' && s.length < min) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MIN_LENGTH,
                    options.message ?? `The minimum length allowed is ${min}`,
                    { min },
                );
            }
            if (typeof max === 'number' && s.length > max) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MAX_LENGTH,
                    options.message ?? `The maximum length allowed is ${max}`,
                    { max },
                );
            }
            // Fallback (shouldn't normally hit — `isLength` returned false but
            // neither bound was crossed). The MIN_LENGTH / MAX_LENGTH codes
            // both require their bound in `data`; without a bound we can't
            // honour the vocabulary contract, so emit the generic code.
            if (typeof min === 'number') {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MIN_LENGTH,
                    options.message ?? 'The value has an invalid length',
                    { min },
                );
            }
            throw createValidupError(
                ctx.value,
                IssueCode.VALUE_INVALID,
                options.message ?? 'The value has an invalid length',
            );
        },
    });
}
