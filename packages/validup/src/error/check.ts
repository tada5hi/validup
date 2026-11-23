/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { INSTANCEOF_PROPERTY, isIssue, matchesInstanceof } from '@ebec/core';
import { hasOwnProperty, isObject } from '../utils';
import { VALIDUP_ERROR_INSTANCE, ValidupError } from './base';

export function isError(input: unknown) : input is Error & { [key: string]: any } {
    // Primary check: anything that walks like an Error in this realm.
    // Keeps cross-realm fallbacks (e.g. errors from another iframe / vm
    // context where `instanceof Error` is false) duck-typed via the
    // `message` shape — which also matches `ValidupError`-shaped throws
    // from a duplicate copy of the package.
    if (typeof Error.isError === 'function' && Error.isError(input)) {
        return true;
    }

    if (!isObject(input)) {
        return false;
    }

    return typeof input.message === 'string' && typeof input.name === 'string';
}

export function isValidupError(error: unknown) : error is ValidupError {
    if (!isError(error)) {
        return false;
    }

    // The marker also identifies duplicate package copies and serialized errors.
    if (error instanceof ValidupError || matchesInstanceof(error, VALIDUP_ERROR_INSTANCE)) {
        return true;
    }

    // An `@instanceof` chain is an explicit class identity, the same signal
    // `isBaseError` decides on. Every @ebec/core `BaseError` carries one,
    // in symbol form in process and as description strings after a JSON
    // round trip, and every subclass can carry well-formed `issues` (e.g. a
    // permission error reporting why a policy evaluation failed). A chain
    // without the validup marker therefore names some other class, and the
    // issue shape below must not override it. `code` is no tiebreaker
    // either: BaseError derives it from `this.constructor.name` unless a
    // class passes one explicitly, and a minifier can mangle that name.
    // Only chain-less input (plain JSON) is classified by shape.
    if (Array.isArray(error[INSTANCEOF_PROPERTY]) || !hasOwnProperty(error, 'issues')) {
        return false;
    }

    // A non-empty, well-formed issue list is required, because an empty
    // array passes `every(...)` vacuously. The exception is an error that
    // identifies itself via `code`: `ValidupError`'s constructor defaults
    // `issues` to `[]`, so a zero-issue ValidupError is a real case.
    // `ValidupError` passes its `code` explicitly, so it survives both
    // serialization and minification.
    return Array.isArray(error.issues) &&
        error.issues.every((issue) => isIssue(issue)) &&
        (error.issues.length > 0 || error.code === 'VALIDUP_ERROR');
}
