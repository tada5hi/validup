/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { IssueCode, createValidupError  } from 'validup';
import type { Validator } from 'validup';
import type { BaseFactoryOptions } from '../module';
import { toValidatorString } from '../module';

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
        throw createValidupError(ctx.value, IssueCode.EMAIL, message);
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
        throw createValidupError(ctx.value, IssueCode.URL, message);
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
        throw createValidupError(ctx.value, IssueCode.UUID, message);
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
        throw createValidupError(ctx.value, IssueCode.IP_ADDRESS, message);
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
        throw createValidupError(ctx.value, IssueCode.MAC_ADDRESS, message);
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
        throw createValidupError(ctx.value, IssueCode.DATE, message);
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
        throw createValidupError(ctx.value, IssueCode.DATE, message);
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
        throw createValidupError(ctx.value, IssueCode.JSON, message);
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
        throw createValidupError(ctx.value, IssueCode.BASE64, message);
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
    // Strip validup-only `message` AND `returnScore` before forwarding to
    // validator.js. With `returnScore: true`, validator.js returns a numeric
    // score instead of a boolean — the truthy check below would accept any
    // non-zero score as a pass, so a weak password could squeak through.
    // Drop the flag and force boolean semantics. `message` is dropped from
    // `params` so i18n templates see only the validator.js-side requirements
    // (`{{minLength}}`, `{{minNumbers}}`, …).
    const {
        message: _ignored, 
        returnScore: _alsoIgnored, 
        ...rest 
    } = options;
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        // validator.js mutates the options argument it receives (merging
        // defaults in-place), which would leak `returnScore: false` and other
        // default keys back into our `rest` and then into `params`. Pass a
        // shallow clone so `rest` stays clean and our params payload reflects
        // only what the consumer configured.
        const probeOptions = { ...rest } as validator.StrongPasswordOptions;
        if (validator.isStrongPassword(s, probeOptions) === true) return ctx.value;
        const params: Record<string, unknown> = { ...rest };
        throw createValidupError(
            ctx.value,
            IssueCode.STRONG_PASSWORD,
            message,
            Object.keys(params).length > 0 ? params : undefined,
        );
    };
}
