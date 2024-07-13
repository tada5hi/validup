/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * @see https://github.com/express-validator/express-validator/blob/bec1dcbaa29002dcd21093ec84818c4671063b5d/src/field-selection.ts#L214
 * @param parts
 */
export function arrayToPropertyPath(parts: readonly string[]) : string {
    return parts.reduce((prev, segment) => {
        let part = '';
        segment = segment === '\\*' ? '*' : segment;

        // TODO: Handle brackets?
        if (segment.includes('.')) {
            // Special char key access
            part = `["${segment}"]`;
        } else if (/^\d+$/.test(segment)) {
            // Index access
            part = `[${segment}]`;
        } else if (prev) {
            // Object key access
            part = `.${segment}`;
        } else {
            // Top level key
            part = segment;
        }

        return prev + part;
    }, '');
}
