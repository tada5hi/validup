/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidatorDescriptor } from './types';
import { isObject } from '../utils';

/**
 * Duck-typed guard for {@link ValidatorDescriptor}. Used by `mount()` to
 * distinguish a descriptor from a bare `Validator` function and from a
 * nested `IContainer` (which is also an object but carries `run` /
 * `safeRun` methods — the descriptor has a `run` function but no
 * `safeRun`).
 *
 * Duck-typed (not `instanceof`) so descriptors built from a different
 * copy of the package — adapters bundling their own `validup` dependency,
 * pnpm workspaces with multiple installs — still round-trip cleanly.
 */
export function isValidatorDescriptor<C = unknown, Out = unknown>(
    input: unknown,
): input is ValidatorDescriptor<C, Out> {
    if (!isObject(input)) {
        return false;
    }

    return (
        typeof input.run === 'function' &&
        typeof input.safeRun !== 'function'
    );
}
