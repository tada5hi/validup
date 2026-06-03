/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { OptionalValue } from '../constants';

export type OptionalValueInput = `${OptionalValue}` | readonly `${OptionalValue}`[];

/**
 * Check whether `value` qualifies as "optional" under the supplied
 * `optionalValue` definition.
 *
 * The definition can be a single atom (`'undefined'`, `'null'`, `'empty_string'`,
 * `'zero'`, `'false'`, `'nan'`, `'falsy'`) or an array of atoms — in array form
 * the value is optional iff **any** atom matches. Atoms match exactly one
 * runtime value (the only exception is `'falsy'`, which stays as a composite
 * shortcut for "any JS falsy value"). To skip on `null` *or* `undefined`,
 * pass `['null', 'undefined']` explicitly.
 *
 * Default is `'falsy'` so `{ optional: true }` alone matches the typical
 * form-input case (an untouched `<input>` holds `''`, not `undefined`).
 * Callers where `0`/`false` are meaningful should pick specific atoms or
 * the predicate form (`optional: (v) => …`).
 */
export function isOptionalValue(
    value: unknown,
    optionalValue?: OptionalValueInput,
) {
    const input = optionalValue ?? OptionalValue.FALSY;
    if (Array.isArray(input)) {
        for (const atom of input) {
            if (matchAtom(value, atom)) {
                return true;
            }
        }
        return false;
    }
    return matchAtom(value, input as `${OptionalValue}`);
}

function matchAtom(value: unknown, atom: `${OptionalValue}`): boolean {
    switch (atom) {
        case OptionalValue.UNDEFINED:
            return typeof value === 'undefined';
        case OptionalValue.NULL:
            return value === null;
        case OptionalValue.EMPTY_STRING:
            return value === '';
        case OptionalValue.ZERO:
            return value === 0;
        case OptionalValue.FALSE:
            return value === false;
        case OptionalValue.NAN:
            return typeof value === 'number' && Number.isNaN(value);
        case OptionalValue.FALSY:
            return !value;
        default:
            return false;
    }
}
