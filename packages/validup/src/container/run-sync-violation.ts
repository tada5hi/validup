/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Thrown by `Container.runSync` when a validator returns a Promise or a
 * nested container does not implement `runSync`. Marked separately from
 * generic `Error` so the per-mount catch can re-throw it instead of folding
 * it into the issue list (otherwise users would get "Property X is invalid"
 * instead of the structural diagnostic).
 *
 * Internal — not exported from the package barrel.
 */
export class RunSyncViolationError extends Error {
    override readonly name = 'RunSyncViolationError';
}

/**
 * Duck-typed check — robust against `instanceof` mismatches when a duplicate
 * copy of the package exists in the dependency tree, or when the throw
 * crosses a realm boundary. Mirrors the `isValidupError` pattern.
 */
export function isRunSyncViolation(e: unknown): e is RunSyncViolationError {
    if (e instanceof RunSyncViolationError) {
        return true;
    }
    return (
        typeof e === 'object' &&
        e !== null &&
        (e as { name?: unknown }).name === 'RunSyncViolationError'
    );
}
