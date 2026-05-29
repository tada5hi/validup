/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidatorDescriptor } from './types';

/**
 * Factory for a {@link ValidatorDescriptor}. Mirrors the
 * `defineIssueItem` / `defineIssueGroup` shape used elsewhere in the
 * library so authored validators get a stable, typed construction site.
 *
 * @example
 * const validateEmailUnique = defineValidator({
 *     sideEffect: true,
 *     run: async (ctx) => {
 *         const taken = await api.isEmailTaken(ctx.value as string);
 *         if (taken) throw new Error('Email is already taken');
 *         return ctx.value;
 *     },
 * });
 */
export function defineValidator<C = unknown, Out = unknown>(
    descriptor: ValidatorDescriptor<C, Out>,
): ValidatorDescriptor<C, Out> {
    return descriptor;
}
