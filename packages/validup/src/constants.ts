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
     * value: undefined
     */
    UNDEFINED = 'undefined',
    /**
     * value: null & undefined
     */
    NULL = 'null',
    /**
     * value: empty string, false, 0
     */
    FALSY = 'falsy',
}
