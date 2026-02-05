/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export enum IssueSeverity {
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
}

export enum IssueCode {
    CUSTOM = 'custom',
    INVALID_VALUE = 'invalid_value',
    INVALID_ELEMENT = 'invalid_element',
    INVALID_KEY = 'invalid_key',
    INVALID_UNION = 'invalid_union',

    TOO_BIG = 'too_big', // maximum
    TOO_SMALL = 'too_small', // minimum
}
