/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isIssue } from '../issue';
import { hasOwnProperty, isObject } from '../utils';
import { ValidupError } from './base';

export function isError(input: unknown) : input is Error & { [key: string]: any } {
    if (!isObject(input)) {
        return false;
    }

    return typeof input.message === 'string';
}

export function isValidupError(error: unknown) : error is ValidupError {
    if (!isError(error)) {
        return false;
    }

    if (error instanceof ValidupError) {
        return true;
    }

    if (!hasOwnProperty(error, 'issues')) {
        return false;
    }

    return Array.isArray(error.issues) &&
        error.issues.every((issue) => isIssue(issue));
}
