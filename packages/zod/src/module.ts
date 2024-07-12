/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidationRunner } from 'validup';
import type { ZodType } from 'zod';
import { buildError } from './error';

export function createRunner(zod: ZodType) : ValidationRunner {
    return async (ctx): Promise<unknown> => {
        const outcome = await zod.safeParseAsync(ctx.value);
        if (outcome.success) {
            return outcome.data;
        }

        throw buildError(outcome.error);
    };
}
