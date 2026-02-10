/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { arrayToPath } from 'pathtrace';

/**
 * Stringify path array to string.
 *
 * @param input
 */
export function stringifyPath(input: PropertyKey[]) : string {
    return arrayToPath(input);
}
