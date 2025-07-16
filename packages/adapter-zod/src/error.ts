/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupNestedError, ValidupValidatorError, hasOwnProperty } from 'validup';
import type { ZodError } from 'zod';

export type ErrorBuildOptions = {
    path: string,
    pathAbsolute?: string,
};

export function buildError(error: ZodError, options: ErrorBuildOptions) {
    const base = new ValidupNestedError();

    for (let i = 0; i < error.issues.length; i++) {
        const issue = error.issues[i];

        let expected : unknown;
        if (hasOwnProperty(issue, 'expected')) {
            expected = issue.expected;
        }

        let received : unknown;
        if (hasOwnProperty(issue, 'received')) {
            received = issue.received;
        }

        let { path } = options;
        if (issue.path) {
            for (let j = 0; j < issue.path.length; j++) {
                const item = issue.path[j];

                if (typeof item === 'string') {
                    path += `.${item}`;
                }

                if (typeof item === 'number') {
                    path += `[${item}]`;
                }
            }
        }

        const child = new ValidupValidatorError({
            path,
            pathAbsolute: options.pathAbsolute || options.path,
            message: issue.message,
            expected,
            received,
        });

        base.addChild(child);
    }

    return base;
}
