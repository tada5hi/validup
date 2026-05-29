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
 * Factory: validator.js `isEmail`. Emits `IssueCode.EMAIL` on failure.
 *
 * Options are flattened — pass validator.js's `IsEmailOptions` keys
 * (`require_display_name`, `allow_utf8_local_part`, …) directly alongside
 * the validup-side `message` override.
 */
export function isEmail<C = unknown>(
    options: BaseFactoryOptions & validator.IsEmailOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid email address';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isEmail(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.EMAIL, message);
        },
    });
}

/**
 * Factory: validator.js `isURL`. Emits `IssueCode.URL` on failure.
 */
export function isURL<C = unknown>(
    options: BaseFactoryOptions & validator.IsURLOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid URL';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isURL(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.URL, message);
        },
    });
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
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid UUID';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isUUID(s, options.version)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.UUID, message);
        },
    });
}

/**
 * Factory: validator.js `isIP`. Emits `IssueCode.IP_ADDRESS` on failure.
 *
 * `version` mirrors validator.js's positional second argument.
 */
export function isIP<C = unknown>(
    options: BaseFactoryOptions & { version?: '4' | '6' | 4 | 6 } = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid IP address';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isIP(s, options.version)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.IP_ADDRESS, message);
        },
    });
}

/**
 * Factory: validator.js `isMACAddress`. Emits `IssueCode.MAC_ADDRESS` on failure.
 */
export function isMACAddress<C = unknown>(
    options: BaseFactoryOptions & validator.IsMACAddressOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid MAC address';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isMACAddress(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.MAC_ADDRESS, message);
        },
    });
}

/**
 * Factory: validator.js `isDate`. Emits `IssueCode.DATE` on failure.
 */
export function isDate<C = unknown>(
    options: BaseFactoryOptions & validator.IsDateOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid date';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isDate(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.DATE, message);
        },
    });
}

/**
 * Factory: validator.js `isISO8601`. Emits `IssueCode.DATE` on failure
 * (same code as `isDate` — both produce the "is this a parseable date"
 * outcome from the consumer's perspective).
 */
export function isISO8601<C = unknown>(
    options: BaseFactoryOptions & validator.IsISO8601Options = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not a valid date';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isISO8601(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.DATE, message);
        },
    });
}

/**
 * Factory: validator.js `isJSON`. Emits `IssueCode.JSON` on failure.
 */
export function isJSON<C = unknown>(
    options: BaseFactoryOptions & validator.IsJSONOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not valid JSON';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isJSON(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.JSON, message);
        },
    });
}

/**
 * Factory: validator.js `isBase64`. Emits `IssueCode.BASE64` on failure.
 */
export function isBase64<C = unknown>(
    options: BaseFactoryOptions & validator.IsBase64Options = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value is not valid base64';
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            if (validator.isBase64(s, options)) return ctx.value;
            throw createValidupError(ctx.value, IssueCode.BASE64, message);
        },
    });
}

/**
 * The subset of `validator.StrongPasswordOptions` keys that describe
 * *strength requirements* — what the consumer wants the password to look
 * like, as opposed to scoring weights (`pointsPerUnique`,
 * `pointsForContainingLower`, …) which only affect validator.js's
 * `returnScore` mode. Only these keys surface on `IssueCode.STRONG_PASSWORD`'s
 * `params` payload, matching the documented vocabulary contract.
 */
const STRONG_PASSWORD_REQUIREMENT_KEYS = [
    'minLength',
    'minLowercase',
    'minUppercase',
    'minNumbers',
    'minSymbols',
] as const;

type StrongPasswordRequirementParams = {
    minLength?: number,
    minLowercase?: number,
    minUppercase?: number,
    minNumbers?: number,
    minSymbols?: number,
};

/**
 * Factory: validator.js `isStrongPassword`. Emits
 * `IssueCode.STRONG_PASSWORD` on failure. `params` carries only the
 * documented strength-requirement keys (`minLength`, `minLowercase`,
 * `minUppercase`, `minNumbers`, `minSymbols`) so i18n templates can quote
 * them:
 *
 * ```ts
 * isStrongPassword({ minLength: 12, minNumbers: 2 });
 * // → IssueCode.STRONG_PASSWORD, params: { minLength: 12, minNumbers: 2 }
 * ```
 *
 * Scoring weights (`pointsPerUnique`, `pointsForContainingLower`, …) are
 * still forwarded to validator.js so they continue to influence the
 * pass/fail decision (and any `returnScore`-shaped diagnostics), but they
 * do NOT appear in `params` — i18n templates would never want to render
 * "must score at least N points per unique character" to the user.
 */
export function isStrongPassword<C = unknown>(
    options: BaseFactoryOptions & validator.StrongPasswordOptions = {},
): ValidatorDescriptor<C> {
    const message = options.message ?? 'The value does not meet the password strength requirements';
    // Strip validup-only `message` AND `returnScore` before forwarding to
    // validator.js. With `returnScore: true`, validator.js returns a numeric
    // score instead of a boolean — the truthy check below would accept any
    // non-zero score as a pass, so a weak password could squeak through.
    // Drop the flag and force boolean semantics.
    const {
        message: _ignored,
        returnScore: _alsoIgnored,
        ...rest
    } = options;
    // Project `rest` down to the documented strength-requirement subset for
    // the `params` payload. The full `rest` (including scoring weights) is
    // what validator.js sees — but consumer-facing `IssueItem.params`
    // matches the documented vocabulary contract.
    //
    // Build the template once at factory time; clone it per failure so a
    // consumer mutating `issue.params` on one IssueItem can't bleed into a
    // future failure from the same factory.
    const paramsTemplate: StrongPasswordRequirementParams = {};
    for (const key of STRONG_PASSWORD_REQUIREMENT_KEYS) {
        if (typeof rest[key] === 'number') {
            paramsTemplate[key] = rest[key];
        }
    }
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            // validator.js mutates the options argument it receives (merging
            // defaults in-place). Pass a shallow clone so consumer-side
            // `options` and our captured template stay clean.
            const probeOptions = { ...rest } as validator.StrongPasswordOptions;
            if (validator.isStrongPassword(s, probeOptions) === true) return ctx.value;
            throw createValidupError(
                ctx.value,
                IssueCode.STRONG_PASSWORD,
                message,
                { ...paramsTemplate },
            );
        },
    });
}
