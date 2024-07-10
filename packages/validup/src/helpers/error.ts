/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { distinctArray } from 'smob';

export function buildErrorMessageForAttributes(input: string[] | Record<string, any>) {
    let names: string[];
    if (Array.isArray(input)) {
        names = distinctArray(input);
    } else {
        names = Object.keys(input);
    }

    if (names.length === 0) {
        return 'An unexpected error occurred.';
    }

    if (names.length > 1) {
        return `The attributes ${names.join(', ')} are invalid.`;
    }

    return `The attribute ${String(names[0])} is invalid.`;
}
