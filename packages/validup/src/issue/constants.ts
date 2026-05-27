/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Vocabulary of well-known issue codes. Adapter packages map foreign
 * validator codes onto these so consumer-side translation catalogs
 * (e.g. `@ilingo/validup`) can ship one localized message per code
 * instead of falling back to a generic "invalid value" fallback.
 *
 * Tracks the common ground between vuelidate, zod, joi, and yup — 16
 * codes lift directly from vuelidate's catalog (snake_cased to match
 * validup's convention); 3 modern additions (`PATTERN_MISMATCH`,
 * `NOT_UUID`, `INVALID_DATE`) cover ground vuelidate predates.
 *
 * Ad-hoc / project-specific codes still work — `IssueItem.code` is
 * widened to `IssueCode | (string & {})`, so `defineIssueItem({ code:
 * 'email_taken', ... })` is valid. If you want a typed const for your
 * own codes, define one alongside this one:
 *
 * ```ts
 * import { IssueCode } from 'validup';
 *
 * export const AppCode = {
 *     ...IssueCode,
 *     EMAIL_TAKEN: 'email_taken',
 * } as const;
 * ```
 *
 * Each entry's JSDoc documents the structured `params` adapters should
 * attach when constructing the issue — templates can rely on those
 * placeholders being present (`{{min}}`, `{{max}}`, `{{other}}`, etc.).
 */
export const IssueCode = {
    // ──────────────────────────── Generic / structural ────────────────────────────
    /** Generic fallback when no more-specific code applies. `params`: — */
    VALUE_INVALID: 'value_invalid',
    /** Every branch of a `oneOf` container failed. `params`: — */
    ONE_OF_FAILED: 'one_of_failed',

    // ──────────────────────────── Presence ────────────────────────────
    /** Value is missing, `undefined`, `null`, or empty per the validator's semantics. `params`: — */
    REQUIRED: 'required',

    // ──────────────────────────── Type assertions ────────────────────────────
    /** Value contains characters outside the alphabetical set. `params`: — */
    ALPHA: 'alpha',
    /** Value contains characters outside the alphanumeric set. `params`: — */
    ALPHA_NUM: 'alpha_num',
    /** Value is not a number. `params`: — */
    NUMERIC: 'numeric',
    /** Value is not an integer. `params`: — */
    INTEGER: 'integer',
    /** Value is not a decimal number. `params`: — */
    DECIMAL: 'decimal',

    // ──────────────────────────── Length (strings, arrays) ────────────────────────────
    /** Value is shorter than the configured minimum. `params`: `{ min: number }` */
    MIN_LENGTH: 'min_length',
    /** Value is longer than the configured maximum. `params`: `{ max: number }` */
    MAX_LENGTH: 'max_length',

    // ──────────────────────────── Numeric range ────────────────────────────
    /** Numeric value is below the configured minimum. `params`: `{ min: number }` */
    MIN_VALUE: 'min_value',
    /** Numeric value is above the configured maximum. `params`: `{ max: number }` */
    MAX_VALUE: 'max_value',
    /** Numeric value falls outside the configured `[min, max]` range. `params`: `{ min: number, max: number }` */
    BETWEEN: 'between',

    // ──────────────────────────── String format ────────────────────────────
    /** Value is not a valid email address. `params`: — */
    EMAIL: 'email',
    /** Value is not a valid URL. `params`: — */
    URL: 'url',
    /** Value is not a valid IP address. `params`: — */
    IP_ADDRESS: 'ip_address',
    /** Value is not a valid MAC address. `params`: — */
    MAC_ADDRESS: 'mac_address',
    /** Value is not a valid UUID. `params`: — */
    UUID: 'uuid',
    /** Value is not a valid date / cannot be parsed as a date. `params`: — */
    DATE: 'date',
    /**
     * Value does not match the expected regex pattern. `params`:
     * `{ pattern: string }` — source of the regex without flags so
     * catalogs can quote it in human-readable form.
     */
    PATTERN: 'pattern',
    /** Value is not valid JSON. `params`: — */
    JSON: 'json',
    /** Value is not valid base64. `params`: — */
    BASE64: 'base64',
    /**
     * Value does not meet the configured strong-password rules. `params`:
     * `{ minLength?: number, minLowercase?: number, minUppercase?: number,
     * minNumbers?: number, minSymbols?: number }` — only the keys the
     * adapter chose to surface; missing keys mean "the default for that
     * setting wasn't configured."
     */
    STRONG_PASSWORD: 'strong_password',

    // ──────────────────────────── Comparison ────────────────────────────
    /**
     * Value must equal another named field's value (sibling-field assertion,
     * e.g. password-confirm). `params`: `{ other: string }` — the name of
     * the field being compared against.
     */
    SAME_AS: 'same_as',
} as const;

export type IssueCode = typeof IssueCode[keyof typeof IssueCode];
