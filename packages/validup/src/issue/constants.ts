/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Registry of well-known issue codes. Third-party packages can extend the
 * union via TypeScript declaration merging. Keys are conventionally
 * `UPPER_SNAKE_CASE` (matching the built-ins below); values are the runtime
 * literal strings used on `IssueItem.code` (conventionally lowercase):
 *
 * ```ts
 * declare module 'validup' {
 *     interface IssueCodeRegistry {
 *         EMAIL_TAKEN: 'email_taken';
 *     }
 * }
 * ```
 *
 * After augmentation, `IssueCode` widens to include the new literal so
 * `defineIssueItem({ code: 'email_taken', ... })` is type-checked.
 *
 * The shipped vocabulary tracks the common ground between
 * vuelidate, zod, joi, and yup — enough that adapter packages can map
 * foreign codes onto these without inventing per-library variants, and
 * enough that i18n catalogs (e.g. `@ilingo/validup`) can ship one
 * translation per code instead of falling back to a generic "invalid"
 * message.
 *
 * Each entry's JSDoc documents the structured `params` adapters should
 * attach when constructing the issue — consumer-side templates can rely
 * on those placeholders being present (`{{min}}`, `{{max}}`, `{{other}}`,
 * etc.).
 */
export interface IssueCodeRegistry {
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
    NOT_UUID: 'not_uuid',
    /** Value is not a valid date / cannot be parsed as a date. `params`: — */
    INVALID_DATE: 'invalid_date',
    /**
     * Value does not match the expected regex pattern. `params`:
     * `{ pattern: string }` (source of the regex, without flags — adapters
     * should pass the human-readable form so catalogs can quote it).
     */
    PATTERN_MISMATCH: 'pattern_mismatch',

    // ──────────────────────────── Comparison ────────────────────────────
    /**
     * Value must equal another named field's value (sibling-field assertion,
     * e.g. password-confirm). `params`: `{ other: string }` — the name of
     * the field being compared against.
     */
    SAME_AS: 'same_as',
}

export type IssueCode = IssueCodeRegistry[keyof IssueCodeRegistry];

export const IssueCode = {
    VALUE_INVALID: 'value_invalid',
    ONE_OF_FAILED: 'one_of_failed',
    REQUIRED: 'required',
    ALPHA: 'alpha',
    ALPHA_NUM: 'alpha_num',
    NUMERIC: 'numeric',
    INTEGER: 'integer',
    DECIMAL: 'decimal',
    MIN_LENGTH: 'min_length',
    MAX_LENGTH: 'max_length',
    MIN_VALUE: 'min_value',
    MAX_VALUE: 'max_value',
    BETWEEN: 'between',
    EMAIL: 'email',
    URL: 'url',
    IP_ADDRESS: 'ip_address',
    MAC_ADDRESS: 'mac_address',
    NOT_UUID: 'not_uuid',
    INVALID_DATE: 'invalid_date',
    PATTERN_MISMATCH: 'pattern_mismatch',
    SAME_AS: 'same_as',
} as const satisfies { [K in keyof IssueCodeRegistry]: IssueCodeRegistry[K] };
