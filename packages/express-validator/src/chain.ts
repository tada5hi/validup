/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { type ValidationChain, body } from 'express-validator';

/**
 * Build a fresh express-validator `body()` chain.
 *
 * Deliberate alias for `express-validator`'s own `body()` — kept for
 * stylistic consistency with the rest of the `@validup/express-validator`
 * API. Calling `body()` from `express-validator` directly is equivalent and
 * fully supported; reach for `createValidationChain()` if you prefer to
 * keep all chain creation behind the validup-integration package, or
 * import `body()` directly if you'd rather skip the indirection.
 *
 * No behavior is added on top of `body()` — there is no preset, no
 * sanitizer, no validup-aware customization. If a future minor version
 * adds behavior, it will be opt-in via parameters; the no-arg call will
 * stay equivalent to `body()`.
 */
export function createValidationChain() : ValidationChain {
    return body();
}
