/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum GroupKey {
    WILDCARD = '*',
}

/**
 * Atomic vocabulary for `MountOptions.optionalValue`. Each atom matches
 * exactly one runtime value (the exception is `FALSY`, which stays as a
 * composite shortcut). Compose multiple atoms by passing an array:
 * `optionalValue: ['undefined', 'null', 'empty_string']`.
 */
export enum OptionalValue {
    /** `value === undefined`. */
    UNDEFINED = 'undefined',
    /** `value === null` (does **not** include `undefined`). */
    NULL = 'null',
    /** `value === ''`. */
    EMPTY_STRING = 'empty_string',
    /** `value === 0` (also matches `-0`). */
    ZERO = 'zero',
    /** `value === false`. */
    FALSE = 'false',
    /** `Number.isNaN(value)`. */
    NAN = 'nan',
    /**
     * Composite shortcut — any JS falsy value
     * (`undefined`, `null`, `''`, `0`, `false`, `NaN`). **Default** when
     * `optionalValue` is not set, so `{ optional: true }` alone handles
     * the common form-input case (untouched `<input>` holds `''`).
     *
     * For fields where `0` or `false` is a meaningful value, pick the
     * specific atoms instead (e.g. `optionalValue: ['undefined', 'null',
     * 'empty_string']`) or use the predicate form `optional: (v) => …`.
     */
    FALSY = 'falsy',
}
