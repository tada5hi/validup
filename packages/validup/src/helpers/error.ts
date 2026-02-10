/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { distinctArray } from 'smob';

export function buildErrorMessageForAttribute(key: PropertyKey) {
    return `Property ${String(key)} is invalid`;
}

export function buildErrorMessageForAttributes(input: PropertyKey[] | Record<string, any>) {
    let names: PropertyKey[];
    if (Array.isArray(input)) {
        names = distinctArray(input);
    } else {
        names = Object.keys(input);
    }

    if (names.length === 0) {
        return 'Properties are invalid';
    }

    if (names.length > 1) {
        return `Properties ${names.join(', ')} are invalid.`;
    }

    return buildErrorMessageForAttribute(names[0]);
}
