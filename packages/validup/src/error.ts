/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidatorErrorOptions } from './types';

export class ValidationError extends Error {
    code: null | string;

    children: Record<string, any>[];

    constructor(
        message: string,
        options: ValidatorErrorOptions = {},
    ) {
        super(message);

        this.code = options.code ?? null;
        this.children = options.children ?? [];
    }
}
