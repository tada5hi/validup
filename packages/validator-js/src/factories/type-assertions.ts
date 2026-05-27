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
 */
export function isAlpha<C = unknown>(options: BaseFactoryOptions & {
    locale?: validator.AlphaLocale,
    options?: validator.IsAlphaOptions,
} = {}): Validator<C> {
    const message = options.message ?? 'The value is not alphabetical';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isAlpha(s, options.locale, options.options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.ALPHA, message);
    };
}

/**
 * Factory: validator.js `isAlphanumeric`. Emits `IssueCode.ALPHA_NUM` on failure.
 */
export function isAlphanumeric<C = unknown>(options: BaseFactoryOptions & {
    locale?: validator.AlphanumericLocale,
    options?: validator.IsAlphanumericOptions,
} = {}): Validator<C> {
    const message = options.message ?? 'The value must be alphanumeric';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isAlphanumeric(s, options.locale, options.options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.ALPHA_NUM, message);
    };
}

/**
 * Factory: validator.js `isNumeric`. Emits `IssueCode.NUMERIC` on failure.
 */
export function isNumeric<C = unknown>(options: BaseFactoryOptions & {
    options?: validator.IsNumericOptions,
} = {}): Validator<C> {
    const message = options.message ?? 'The value must be numeric';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isNumeric(s, options.options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.NUMERIC, message);
    };
}

/**
 * Factory: validator.js `isDecimal`. Emits `IssueCode.DECIMAL` on failure.
 */
export function isDecimal<C = unknown>(options: BaseFactoryOptions & {
    options?: validator.IsDecimalOptions,
} = {}): Validator<C> {
    const message = options.message ?? 'The value must be a decimal number';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isDecimal(s, options.options)) return ctx.value;
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
 *
 * Mirrors validator.js's `{ min, max, lt, gt, allow_leading_zeroes }`
 * options on the underlying call but distinguishes "type" from "range"
 * failures on output.
 */
export function isInt<C = unknown>(options: BaseFactoryOptions & {
    options?: validator.IsIntOptions,
} = {}): Validator<C> {
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        const isInteger = validator.isInt(s, { allow_leading_zeroes: options.options?.allow_leading_zeroes });
        if (!isInteger) {
            return throwValidupError(
                ctx.value,
                IssueCode.INTEGER,
                options.message ?? 'The value must be an integer',
            );
        }
        // Type check passed; now check range bounds separately so we emit
        // a meaningful code instead of collapsing back onto INTEGER.
        const numeric = Number(s);
        const min = options.options?.min;
        const max = options.options?.max;
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
        // Final pass with the original options to cover gt/lt/etc.
        if (!validator.isInt(s, options.options)) {
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
export function isFloat<C = unknown>(options: BaseFactoryOptions & {
    options?: validator.IsFloatOptions,
} = {}): Validator<C> {
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        const isDecimal = validator.isFloat(s);
        if (!isDecimal) {
            return throwValidupError(
                ctx.value,
                IssueCode.DECIMAL,
                options.message ?? 'The value must be a decimal number',
            );
        }
        const numeric = Number(s);
        const min = options.options?.min;
        const max = options.options?.max;
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
        if (!validator.isFloat(s, options.options)) {
            return throwValidupError(
                ctx.value,
                IssueCode.DECIMAL,
                options.message ?? 'The value must be a decimal number',
            );
        }
        return ctx.value;
    };
}
