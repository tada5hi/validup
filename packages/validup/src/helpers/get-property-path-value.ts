/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { propertyPathToArray } from './property-path-to-array';

export function getPropertyPathValue(
    data: Record<string, any>,
    path: string,
): unknown {
    const parts = propertyPathToArray(path);

    let temp = data;
    let index = 0;
    while (index < parts.length) {
        if (!isObject(temp) && !Array.isArray(temp)) {
            break;
        }

        temp = temp[parts[index]];
        index++;
    }

    return temp;
}

function isIndex(input: string | number) : input is number {
    return typeof input === 'number' || !Number.isNaN(Number.parseInt(input, 10));
}

export function setPropertyPathValue(
    data: Record<string, any> | Record<string, any>[],
    path: string | string[],
    value: unknown,
) {
    const parts = Array.isArray(path) ? path : propertyPathToArray(path);

    let temp = data;
    let index = 0;
    while (index < parts.length) {
        if (!Array.isArray(temp) && !isObject(temp)) {
            break;
        }

        const key = parts[index] as keyof typeof temp;
        // [foo, '0']
        if (typeof temp[key] === 'undefined') {
            if (isIndex(key + 1)) {
                (temp as Record<string, any>)[key] = [];
            } else {
                temp[key] = {};
            }
        }

        if (index === parts.length - 1) {
            temp[key] = value;
            break;
        }

        index++;
        temp = temp[key];
    }

    return data;
}
