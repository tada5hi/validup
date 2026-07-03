/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type PathsStrictViolationInput = {
    pathsToInclude?: string[],
    pathsToExclude?: string[],
};

/**
 * Thrown by a `Container` run (all variants) when `pathsStrict` is enabled and
 * one or more `pathsToInclude` / `pathsToExclude` entries matched **no mount** —
 * neither an exact key match nor a prefix descent into a container mount. It
 * signals a misconfigured validator graph (typically a mount key that was
 * renamed out from under a caller's static path list), NOT a validation failure
 * of the input.
 *
 * Like `RunSyncViolationError` it is structural, so the per-mount catch and
 * `safeRun` / `safeRunSync` re-throw it verbatim instead of folding it into the
 * issue list or a `Result.failure`. Unlike `RunSyncViolationError` it IS
 * exported from the package barrel — the whole point is that consumers catch it,
 * read `pathsToInclude` / `pathsToExclude`, and surface which paths went stale.
 *
 * The reported paths are **absolute** (prefixed with the owning container's
 * `path` when the violation happens inside a nested container), so a caller sees
 * `user.email` rather than the child-local `email`.
 */
export class PathsStrictViolationError extends Error {
    override readonly name = 'PathsStrictViolationError';

    /** Absolute `pathsToInclude` entries that matched no mount. */
    readonly pathsToInclude: string[];

    /** Absolute `pathsToExclude` entries that matched no mount. */
    readonly pathsToExclude: string[];

    constructor(input: PathsStrictViolationInput) {
        const pathsToInclude = input.pathsToInclude ?? [];
        const pathsToExclude = input.pathsToExclude ?? [];

        const parts: string[] = [];
        if (pathsToInclude.length > 0) {
            parts.push(`pathsToInclude has no mount for: ${pathsToInclude.join(', ')}`);
        }
        if (pathsToExclude.length > 0) {
            parts.push(`pathsToExclude has no mount for: ${pathsToExclude.join(', ')}`);
        }

        super(`pathsStrict: ${parts.join('; ')}`);

        this.pathsToInclude = pathsToInclude;
        this.pathsToExclude = pathsToExclude;
    }
}

/**
 * Duck-typed check — robust against `instanceof` mismatches when a duplicate
 * copy of the package exists in the dependency tree, or when the throw crosses
 * a realm boundary. Mirrors the `isValidupError` / `isRunSyncViolation` pattern.
 */
export function isPathsStrictViolation(e: unknown): e is PathsStrictViolationError {
    if (e instanceof PathsStrictViolationError) {
        return true;
    }
    return (
        typeof e === 'object' &&
        e !== null &&
        (e as { name?: unknown }).name === 'PathsStrictViolationError'
    );
}
