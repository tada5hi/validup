/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ValidationAttributeErrorOptions = {
    path: (string | number)[],
    message?: string,
    code?: string | null,
    received?: unknown,
    expected?: unknown
};

export class ValidationAttributeError extends Error {
    readonly path: (string | number)[];

    readonly code?: string | null;

    readonly received?: unknown;

    readonly expected?: unknown;

    constructor(options: ValidationAttributeErrorOptions) {
        super(options.message);

        this.path = options.path;
        this.code = options.code;
        this.received = options.received;
        this.expected = options.expected;
    }
}
