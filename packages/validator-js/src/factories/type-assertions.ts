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
 * Factory: validator.js `isAlpha`. Emits `IssueCode.ALPHA` on failure.
 *
 * `locale` (validator.js's positional second arg) is promoted into the
 * flat options object; everything else passes through as `IsAlphaOptions`.
 */
export function isAlpha<C = unknown>(
    options: BaseFactoryOptions & validator.IsAlphaOptions & {
        locale?: validator.AlphaLocale,
    } = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not alphabetical';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isAlpha(s, options.locale, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.ALPHA, message);
        },
    });
}

/**
 * Factory: validator.js `isAlphanumeric`. Emits `IssueCode.ALPHA_NUM` on failure.
 */
export function isAlphanumeric<C = unknown>(
    options: BaseFactoryOptions & validator.IsAlphanumericOptions & {
        locale?: validator.AlphanumericLocale,
    } = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value must be alphanumeric';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isAlphanumeric(s, options.locale, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.ALPHA_NUM, message);
        },
    });
}

/**
 * Factory: validator.js `isNumeric`. Emits `IssueCode.NUMERIC` on failure.
 */
export function isNumeric<C = unknown>(
    options: BaseFactoryOptions & validator.IsNumericOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value must be numeric';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isNumeric(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.NUMERIC, message);
        },
    });
}

/**
 * Factory: validator.js `isDecimal`. Emits `IssueCode.DECIMAL` on failure.
 */
export function isDecimal<C = unknown>(
    options: BaseFactoryOptions & validator.IsDecimalOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value must be a decimal number';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isDecimal(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.DECIMAL, message);
        },
    });
}

/**
 * Factory: validator.js `isInt`. Resolves the right vocabulary code
 * based on what failed:
 *
 * - Value isn't an integer at all → `IssueCode.INTEGER`.
 * - Value below `min` (inclusive) or `gt` (exclusive) → `IssueCode.MIN_VALUE`
 *   (params: `{ min }`). For `gt`, `params.min` is `options.gt` — i18n
 *   templates can quote the boundary; the precise inclusive/exclusive
 *   wording comes from `message`.
 * - Value above `max` (inclusive) or `lt` (exclusive) → `IssueCode.MAX_VALUE`
 *   (params: `{ max }`). Same treatment as `gt` → `params.max` is `options.lt`.
 */
export function isInt<C = unknown>(
    options: BaseFactoryOptions & validator.IsIntOptions = {},
): ValidatorDescriptor<C> {
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            // Type check first — strip range bounds so a non-integer always
            // surfaces as INTEGER instead of being swallowed by a range failure.
            const isInteger = validator.isInt(s, { allow_leading_zeroes: options.allow_leading_zeroes });
            if (!isInteger) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.INTEGER,
                    options.message ?? 'The value must be an integer',
                );
            }
            const numeric = Number(s);
            const {
                min,
                max,
                lt,
                gt,
            } = options;
            if (typeof min === 'number' && numeric < min) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MIN_VALUE,
                    options.message ?? `The value must be greater than or equal to ${min}`,
                    { min },
                );
            }
            if (typeof gt === 'number' && numeric <= gt) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MIN_VALUE,
                    options.message ?? `The value must be greater than ${gt}`,
                    { min: gt },
                );
            }
            if (typeof max === 'number' && numeric > max) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MAX_VALUE,
                    options.message ?? `The value must be less than or equal to ${max}`,
                    { max },
                );
            }
            if (typeof lt === 'number' && numeric >= lt) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.MAX_VALUE,
                    options.message ?? `The value must be less than ${lt}`,
                    { max: lt },
                );
            }
            // Defensive final pass — catches any remaining option we didn't
            // model explicitly (currently none beyond min/max/lt/gt and
            // allow_leading_zeroes). If this fires the failure is a true type
            // mismatch.
            if (!validator.isInt(s, options)) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.INTEGER,
                    options.message ?? 'The value must be an integer',
                );
            }
            return ctx.value;
        },
    });
}

/**
 * Factory: validator.js `isFloat`. Like {@link isInt} but for decimal
 * numbers — type failure emits `IssueCode.DECIMAL`; range bounds emit
 * `MIN_VALUE` / `MAX_VALUE`. `lt` / `gt` map to `MIN_VALUE` / `MAX_VALUE`
 * the same way `isInt` does.
 *
 * **Locale caveat.** validator.js's locale-aware float parsing (e.g.
 * `'123,45'` under `locale: 'de-DE'`) is opaque to the factory — we use
 * `Number(s)` for the explicit range checks, which returns `NaN` for
 * localized strings. When `locale` is set and the input parses to `NaN`,
 * we skip the explicit range checks and fall through to
 * `validator.isFloat(s, options)`, which DOES handle the locale correctly
 * — but a range failure caught there surfaces as `IssueCode.DECIMAL`
 * instead of `MIN_VALUE` / `MAX_VALUE`. Use the default locale (or
 * normalize the input upstream) when precise range codes matter for i18n.
 */
export function isFloat<C = unknown>(
    options: BaseFactoryOptions & validator.IsFloatOptions = {},
): ValidatorDescriptor<C> {
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            // Pre-check honours `locale` so localized floats (e.g. '123,45' for
            // 'de-DE') aren't rejected by the type gate before the range checks
            // get a chance to run.
            if (!validator.isFloat(s, { locale: options.locale })) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.DECIMAL,
                    options.message ?? 'The value must be a decimal number',
                );
            }
            const numeric = Number(s);
            const {
                min,
                max,
                lt,
                gt,
            } = options;
            // NaN from a localized input skips the explicit range checks — see
            // the JSDoc above for the resulting code-vs-message trade-off.
            if (!Number.isNaN(numeric)) {
                if (typeof min === 'number' && numeric < min) {
                    throw createValidupError(
                        ctx.value,
                        IssueCode.MIN_VALUE,
                        options.message ?? `The value must be greater than or equal to ${min}`,
                        { min },
                    );
                }
                if (typeof gt === 'number' && numeric <= gt) {
                    throw createValidupError(
                        ctx.value,
                        IssueCode.MIN_VALUE,
                        options.message ?? `The value must be greater than ${gt}`,
                        { min: gt },
                    );
                }
                if (typeof max === 'number' && numeric > max) {
                    throw createValidupError(
                        ctx.value,
                        IssueCode.MAX_VALUE,
                        options.message ?? `The value must be less than or equal to ${max}`,
                        { max },
                    );
                }
                if (typeof lt === 'number' && numeric >= lt) {
                    throw createValidupError(
                        ctx.value,
                        IssueCode.MAX_VALUE,
                        options.message ?? `The value must be less than ${lt}`,
                        { max: lt },
                    );
                }
            }
            if (!validator.isFloat(s, options)) {
                throw createValidupError(
                    ctx.value,
                    IssueCode.DECIMAL,
                    options.message ?? 'The value must be a decimal number',
                );
            }
            return ctx.value;
        },
    });
}
