/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { IssueCode } from 'validup';
import type { Validator } from 'validup';
import type { BaseFactoryOptions } from '../module';
import { throwValidupError, toValidatorString } from '../module';

/**
 * Factory: validator.js `isAlpha`. Emits `IssueCode.ALPHA` on failure.
 *
 * `locale` (validator.js's positional second arg) is promoted into the
 * flat options object; everything else passes through as `IsAlphaOptions`.
 */
export function isAlpha<C = unknown>(
    options: BaseFactoryOptions & validator.IsAlphaOptions & {
        locale?: validator.AlphaLocale,
    } = {},
): Validator<C> {
    const message = options.message ?? 'The value is not alphabetical';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isAlpha(s, options.locale, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.ALPHA, message);
    };
}

/**
 * Factory: validator.js `isAlphanumeric`. Emits `IssueCode.ALPHA_NUM` on failure.
 */
export function isAlphanumeric<C = unknown>(
    options: BaseFactoryOptions & validator.IsAlphanumericOptions & {
        locale?: validator.AlphanumericLocale,
    } = {},
): Validator<C> {
    const message = options.message ?? 'The value must be alphanumeric';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isAlphanumeric(s, options.locale, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.ALPHA_NUM, message);
    };
}

/**
 * Factory: validator.js `isNumeric`. Emits `IssueCode.NUMERIC` on failure.
 */
export function isNumeric<C = unknown>(
    options: BaseFactoryOptions & validator.IsNumericOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value must be numeric';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isNumeric(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.NUMERIC, message);
    };
}

/**
 * Factory: validator.js `isDecimal`. Emits `IssueCode.DECIMAL` on failure.
 */
export function isDecimal<C = unknown>(
    options: BaseFactoryOptions & validator.IsDecimalOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value must be a decimal number';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isDecimal(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.DECIMAL, message);
    };
}

/**
 * Factory: validator.js `isInt`. Resolves the right vocabulary code
 * based on what failed:
 *
 * - Value isn't an integer at all → `IssueCode.INTEGER`.
 * - Value is an integer but below `min` → `IssueCode.MIN_VALUE` (params: `{ min }`).
 * - Value is an integer but above `max` → `IssueCode.MAX_VALUE` (params: `{ max }`).
 */
export function isInt<C = unknown>(
    options: BaseFactoryOptions & validator.IsIntOptions = {},
): Validator<C> {
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        // Type check first — strip range bounds so a non-integer always
        // surfaces as INTEGER instead of being swallowed by a range failure.
        const isInteger = validator.isInt(s, { allow_leading_zeroes: options.allow_leading_zeroes });
        if (!isInteger) {
            return throwValidupError(
                ctx.value,
                IssueCode.INTEGER,
                options.message ?? 'The value must be an integer',
            );
        }
        const numeric = Number(s);
        const { min, max } = options;
        if (typeof min === 'number' && numeric < min) {
            return throwValidupError(
                ctx.value,
                IssueCode.MIN_VALUE,
                options.message ?? `The value must be greater than or equal to ${min}`,
                { min },
            );
        }
        if (typeof max === 'number' && numeric > max) {
            return throwValidupError(
                ctx.value,
                IssueCode.MAX_VALUE,
                options.message ?? `The value must be less than or equal to ${max}`,
                { max },
            );
        }
        // Final pass with the full options to cover lt / gt / etc.
        if (!validator.isInt(s, options)) {
            return throwValidupError(
                ctx.value,
                IssueCode.INTEGER,
                options.message ?? 'The value must be an integer',
            );
        }
        return ctx.value;
    };
}

/**
 * Factory: validator.js `isFloat`. Like {@link isInt} but for decimal
 * numbers — type failure emits `IssueCode.DECIMAL`; range bounds emit
 * `MIN_VALUE` / `MAX_VALUE`.
 */
export function isFloat<C = unknown>(
    options: BaseFactoryOptions & validator.IsFloatOptions = {},
): Validator<C> {
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (!validator.isFloat(s)) {
            return throwValidupError(
                ctx.value,
                IssueCode.DECIMAL,
                options.message ?? 'The value must be a decimal number',
            );
        }
        const numeric = Number(s);
        const { min, max } = options;
        if (typeof min === 'number' && numeric < min) {
            return throwValidupError(
                ctx.value,
                IssueCode.MIN_VALUE,
                options.message ?? `The value must be greater than or equal to ${min}`,
                { min },
            );
        }
        if (typeof max === 'number' && numeric > max) {
            return throwValidupError(
                ctx.value,
                IssueCode.MAX_VALUE,
                options.message ?? `The value must be less than or equal to ${max}`,
                { max },
            );
        }
        if (!validator.isFloat(s, options)) {
            return throwValidupError(
                ctx.value,
                IssueCode.DECIMAL,
                options.message ?? 'The value must be a decimal number',
            );
        }
        return ctx.value;
    };
}
