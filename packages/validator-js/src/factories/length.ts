/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { IssueCode } from 'validup';
import type { Validator } from 'validup';
import type { BaseFactoryOptions } from '../module';
import { throwValidupError, toValidatorString } from '../module';

/**
 * Factory: validator.js `isLength`. Detects which bound failed at
 * validation time so the resulting issue carries a useful vocabulary
 * code:
 *
 * - Too short → `IssueCode.MIN_LENGTH` (params: `{ min }`).
 * - Too long → `IssueCode.MAX_LENGTH` (params: `{ max }`).
 *
 * Calling without `min` / `max` is allowed but degenerate — every value
 * passes. `message` overrides the default English string for both bound
 * failures.
 */
export function isLength<C = unknown>(
    options: BaseFactoryOptions & validator.IsLengthOptions = {},
): Validator<C> {
    const { min, max } = options;
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        if (validator.isLength(s, options)) return ctx.value;
        if (typeof min === 'number' && s.length < min) {
            return throwValidupError(
                ctx.value,
                IssueCode.MIN_LENGTH,
                options.message ?? `The minimum length allowed is ${min}`,
                { min },
            );
        }
        if (typeof max === 'number' && s.length > max) {
            return throwValidupError(
                ctx.value,
                IssueCode.MAX_LENGTH,
                options.message ?? `The maximum length allowed is ${max}`,
                { max },
            );
        }
        // Fallback (shouldn't normally hit — `isLength` returned false but
        // neither bound was crossed). Surface as MIN_LENGTH with the
        // configured min as the most informative shape.
        return throwValidupError(
            ctx.value,
            IssueCode.MIN_LENGTH,
            options.message ?? 'The value has an invalid length',
            typeof min === 'number' ? { min } : undefined,
        );
    };
}
