/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type PathFilterResolution = {
    skip: boolean,
    pathsToInclude: string[] | undefined,
    pathsToExclude: string[] | undefined,
};

/**
 * Resolve `pathsToInclude` / `pathsToExclude` against a single mounted item's
 * (already-expanded) local `key`. Returns whether to skip the item, plus the
 * filter sub-lists to forward into a child container — with the parent prefix
 * stripped so the child can match purely against its own local keys.
 *
 * Semantics:
 * - Un-keyed container mount (`key === ''`) shares the parent's namespace, so
 *   filters are forwarded verbatim.
 * - Exact match in `pathsToInclude` / `pathsToExclude` matches the whole mount.
 * - Prefix match (`<key>.…`) only descends into container mounts; leaf
 *   validators with deeper-target filters fall through (skipped for include,
 *   kept for exclude).
 */
export function resolvePathFilter(
    pathsToInclude: string[] | undefined,
    pathsToExclude: string[] | undefined,
    key: string,
    isContainer: boolean,
): PathFilterResolution {
    if (key.length === 0) {
        return {
            skip: false,
            pathsToInclude,
            pathsToExclude,
        };
    }

    let includeForward: string[] | undefined;
    if (typeof pathsToInclude !== 'undefined') {
        let exact = false;
        const stripped: string[] = [];
        for (const path of pathsToInclude) {
            if (path === key) {
                exact = true;
            } else if (isContainer && path.startsWith(`${key}.`)) {
                stripped.push(path.slice(key.length + 1));
            }
        }
        if (exact) {
            includeForward = undefined;
        } else if (stripped.length > 0) {
            includeForward = stripped;
        } else {
            return {
                skip: true,
                pathsToInclude: undefined,
                pathsToExclude: undefined,
            };
        }
    }

    let excludeForward: string[] | undefined;
    if (typeof pathsToExclude !== 'undefined') {
        const stripped: string[] = [];
        for (const path of pathsToExclude) {
            if (path === key) {
                return {
                    skip: true,
                    pathsToInclude: undefined,
                    pathsToExclude: undefined,
                };
            }
            if (isContainer && path.startsWith(`${key}.`)) {
                stripped.push(path.slice(key.length + 1));
            }
        }
        if (stripped.length > 0) {
            excludeForward = stripped;
        }
    }

    return {
        skip: false,
        pathsToInclude: includeForward,
        pathsToExclude: excludeForward,
    };
}
