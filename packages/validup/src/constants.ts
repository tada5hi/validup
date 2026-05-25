/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum GroupKey {
    WILDCARD = '*',
}

export enum OptionalValue {
    /**
     * Treats only `undefined` as optional. Default.
     */
    UNDEFINED = 'undefined',
    /**
     * Treats `null` and `undefined` as optional.
     */
    NULL = 'null',
    /**
     * Treats any JS falsy value as optional — `undefined`, `null`, `false`,
     * `0`, `''`, `NaN`.
     *
     * **Warning**: this includes `0` and `''`. For quantity / numeric fields
     * where `0` is a meaningful value, prefer the predicate form
     * `optional: (value) => boolean` so you keep control over what counts as
     * missing (e.g. `optional: (v) => v === '' || v === undefined` drops the
     * empty string but keeps `0`).
     */
    FALSY = 'falsy',
}
