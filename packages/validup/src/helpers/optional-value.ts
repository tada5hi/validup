/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { OptionalValue } from '../constants';

/**
 * Check if input value (type of) satisfies optional value type constraint.
 *
 * @param value
 * @param optionalValue
 */
export function isOptionalValue(
    value: unknown,
    optionalValue?: `${OptionalValue}`,
) {
    const optionValueNormalized = optionalValue || OptionalValue.UNDEFINED;

    if (optionValueNormalized === OptionalValue.NULL) {
        return value === null;
    }

    if (optionValueNormalized === OptionalValue.UNDEFINED) {
        return typeof value === 'undefined';
    }

    return !value;
}
