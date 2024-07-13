/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Match property names within property paths.
 *
 * @see https://github.com/lodash/lodash/blob/ddfd9b11a0126db2302cb70ec9973b66baec0975/lodash.js#L146C7-L146C118
 */
const rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/**
 * Match backslashes in property paths.
 *
 * @see https://github.com/lodash/lodash/blob/ddfd9b11a0126db2302cb70ec9973b66baec0975/lodash.js#L168C1-L168C54
 */
const reEscapeChar = /\\(\\)?/g;

/**
 * Convert string to property path array.
 *
 * @see https://github.com/lodash/lodash/blob/ddfd9b11a0126db2302cb70ec9973b66baec0975/lodash.js#L6735
 * @param segment
 */
export function propertyPathToArray(segment: string) : string[] {
    const result = [];
    if (segment.charCodeAt(0) === 46 /* . */) {
        result.push('');
    }
    segment.replace(rePropName, (match, number, quote, subString) => {
        result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));

        return match;
    });

    return result;
}
