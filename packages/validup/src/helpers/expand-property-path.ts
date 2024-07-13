/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import { arrayToPropertyPath } from './array-to-property-path';
import { propertyPathToArray } from './property-path-to-array';

export function expandPropertyPath(
    data: Record<string, any>,
    path: string | string[],
    currPath: readonly string[],
): string[] {
    const segments = Array.isArray(path) ? path : propertyPathToArray(path);
    if (!segments.length) {
        // no more paths to traverse
        return [arrayToPropertyPath(currPath)];
    }

    const key = segments[0];
    const rest = segments.slice(1);

    if (
        data !== null &&
        !isObject(data) &&
        !Array.isArray(data)
    ) {
        if (key === '**' && !rest.length) {
            // globstar leaves are always selected
            return [arrayToPropertyPath(currPath)];
        }

        // there still are paths to traverse, but value is a primitive, stop
        return [];
    }

    // Use a non-null value so that non-existing fields are still selected
    data = data || {};

    if (key === '*') {
        return Object.keys(data).flatMap((key) => expandPropertyPath(data[key], rest, currPath.concat(key)));
    }

    if (key === '**') {
        return Object.keys(data).flatMap((key) => {
            const nextPath = currPath.concat(key);
            const value = data[key];
            const set = new Set([
                // recursively find matching sub-paths
                ...expandPropertyPath(value, segments, nextPath),
                // skip the first remaining segment, if it matches the current key
                ...(rest[0] === key ? expandPropertyPath(value, rest.slice(1), nextPath) : []),
            ]);

            return [...set];
        });
    }

    return expandPropertyPath(data[key], rest, currPath.concat(key));
}
