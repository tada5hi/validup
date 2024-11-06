/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupError } from './base';

export type ValidupValidatorErrorOptions = {
    path: string,
    pathAbsolute?: string,
    message?: string,
    code?: string | null,
    received?: unknown,
    expected?: unknown
};

export class ValidupValidatorError extends ValidupError {
    readonly path: string;

    readonly pathAbsolute : string;

    readonly code?: string | null;

    readonly received?: unknown;

    readonly expected?: unknown;

    constructor(options: ValidupValidatorErrorOptions) {
        super(options.message);

        this.path = options.path;
        this.pathAbsolute = options.pathAbsolute ?? options.path;
        this.code = options.code;
        this.received = options.received;
        this.expected = options.expected;
    }
}
