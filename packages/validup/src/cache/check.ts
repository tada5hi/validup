/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IResultCache } from './types';
import { isObject } from '../utils';

/**
 * Duck-typed guard for {@link IResultCache}. Avoids `instanceof`
 * checks so caches constructed from a different copy of the package
 * (workspaces with duplicated `validup` installs, adapter bundles)
 * still round-trip cleanly.
 */
export function isResultCache(input: unknown): input is IResultCache {
    if (!isObject(input)) {
        return false;
    }

    return (
        typeof input.get === 'function' &&
        typeof input.set === 'function' &&
        typeof input.delete === 'function' &&
        typeof input.clear === 'function'
    );
}
