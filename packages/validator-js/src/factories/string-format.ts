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
 * Factory: validator.js `isEmail`. Emits `IssueCode.EMAIL` on failure.
 *
 * Options are flattened — pass validator.js's `IsEmailOptions` keys
 * (`require_display_name`, `allow_utf8_local_part`, …) directly alongside
 * the validup-side `message` override.
 */
export function isEmail<C = unknown>(
    options: BaseFactoryOptions & validator.IsEmailOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid email address';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isEmail(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.EMAIL, message);
    };
}

/**
 * Factory: validator.js `isURL`. Emits `IssueCode.URL` on failure.
 */
export function isURL<C = unknown>(
    options: BaseFactoryOptions & validator.IsURLOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid URL';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isURL(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.URL, message);
    };
}

/**
 * Factory: validator.js `isUUID`. Emits `IssueCode.UUID` on failure.
 *
 * `version` mirrors validator.js's positional second argument
 * (`'1' | '2' | '3' | '4' | '5' | 'all' | 1 | …`). Promoted into the
 * options object so the call site is consistent with the other factories.
 */
export function isUUID<C = unknown>(
    options: BaseFactoryOptions & { version?: validator.UUIDVersion } = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid UUID';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isUUID(s, options.version)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.UUID, message);
    };
}

/**
 * Factory: validator.js `isIP`. Emits `IssueCode.IP_ADDRESS` on failure.
 *
 * `version` mirrors validator.js's positional second argument.
 */
export function isIP<C = unknown>(
    options: BaseFactoryOptions & { version?: '4' | '6' | 4 | 6 } = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid IP address';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isIP(s, options.version)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.IP_ADDRESS, message);
    };
}

/**
 * Factory: validator.js `isMACAddress`. Emits `IssueCode.MAC_ADDRESS` on failure.
 */
export function isMACAddress<C = unknown>(
    options: BaseFactoryOptions & validator.IsMACAddressOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid MAC address';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isMACAddress(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.MAC_ADDRESS, message);
    };
}

/**
 * Factory: validator.js `isDate`. Emits `IssueCode.DATE` on failure.
 */
export function isDate<C = unknown>(
    options: BaseFactoryOptions & validator.IsDateOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid date';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isDate(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.DATE, message);
    };
}

/**
 * Factory: validator.js `isISO8601`. Emits `IssueCode.DATE` on failure
 * (same code as `isDate` — both produce the "is this a parseable date"
 * outcome from the consumer's perspective).
 */
export function isISO8601<C = unknown>(
    options: BaseFactoryOptions & validator.IsISO8601Options = {},
): Validator<C> {
    const message = options.message ?? 'The value is not a valid date';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isISO8601(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.DATE, message);
    };
}

/**
 * Factory: validator.js `isJSON`. Emits `IssueCode.JSON` on failure.
 */
export function isJSON<C = unknown>(
    options: BaseFactoryOptions & validator.IsJSONOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value is not valid JSON';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isJSON(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.JSON, message);
    };
}

/**
 * Factory: validator.js `isBase64`. Emits `IssueCode.BASE64` on failure.
 */
export function isBase64<C = unknown>(
    options: BaseFactoryOptions & validator.IsBase64Options = {},
): Validator<C> {
    const message = options.message ?? 'The value is not valid base64';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isBase64(s, options)) return ctx.value;
        return throwValidupError(ctx.value, IssueCode.BASE64, message);
    };
}

/**
 * Factory: validator.js `isStrongPassword`. Emits
 * `IssueCode.STRONG_PASSWORD` on failure. `params` mirrors the configured
 * options so i18n templates can quote the requirements:
 *
 * ```ts
 * isStrongPassword({ minLength: 12, minNumbers: 2 });
 * // → IssueCode.STRONG_PASSWORD, params: { minLength: 12, minNumbers: 2 }
 * ```
 */
export function isStrongPassword<C = unknown>(
    options: BaseFactoryOptions & validator.StrongPasswordOptions = {},
): Validator<C> {
    const message = options.message ?? 'The value does not meet the password strength requirements';
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isStrongPassword(s, options)) return ctx.value;
        // Strip the validup-only `message` field so params reflect only
        // the validator.js-side requirements — templates reference
        // `{{minLength}}`, `{{minNumbers}}`, … against this object.
        const { message: _, ...rest } = options;
        const params: Record<string, unknown> = { ...rest };
        return throwValidupError(
            ctx.value,
            IssueCode.STRONG_PASSWORD,
            message,
            Object.keys(params).length > 0 ? params : undefined,
        );
    };
}
