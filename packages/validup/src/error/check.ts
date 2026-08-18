/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isIssue, matchesInstanceof } from '@ebec/core';
import { hasOwnProperty, isObject } from '../utils';
import { VALIDUP_ERROR_INSTANCE, ValidupError } from './base';

export function isError(input: unknown) : input is Error & { [key: string]: any } {
    // Primary check: anything that walks like an Error in this realm.
    // Keeps cross-realm fallbacks (e.g. errors from another iframe / vm
    // context where `instanceof Error` is false) duck-typed via the
    // `message` shape — which also matches `ValidupError`-shaped throws
    // from a duplicate copy of the package.
    if (input instanceof Error) {
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

    if (error instanceof ValidupError) {
        return true;
    }

    // Matches the marker's symbol form (an in-process ValidupError from a
    // duplicate package copy) or its serialized description string (a
    // ValidupError rehydrated from `toJSON()` output) — either way, no
    // ambiguity with a plain BaseError/HTTPError, which never carries this
    // marker.
    if (matchesInstanceof(error, VALIDUP_ERROR_INSTANCE)) {
        return true;
    }

    if (!hasOwnProperty(error, 'issues')) {
        return false;
    }

    // Every BaseError (and therefore every @ebec/http error) now carries an
    // own `issues` array that defaults to `[]`. `[].every(...)` is
    // vacuously true, so an empty array is not on its own evidence of a
    // validation failure — a non-empty, well-formed issue list is required,
    // UNLESS the error already identifies itself as a ValidupError via
    // `code`. `ValidupError`'s constructor defaults `issues` to `[]`, so a
    // zero-issue ValidupError is a real case, not just an internal
    // invariant every call site avoids: one produced before the
    // `@instanceof` marker existed (validup <= 2.0.0), or one crossing a
    // boundary that only carries the plain JSON shape, has no `instanceof`
    // match and no marker to fall back on — but `code` survives
    // serialization, so it is the identity signal of last resort here.
    return Array.isArray(error.issues) &&
        error.issues.every((issue) => isIssue(issue)) &&
        (error.issues.length > 0 || error.code === 'VALIDUP_ERROR');
}
