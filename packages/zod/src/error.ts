/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidationAttributeError, ValidationNestedError, hasOwnProperty } from 'validup';
import type { ZodError } from 'zod';

export function buildError(error: ZodError) {
    const base = new ValidationNestedError();

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

        const child = new ValidationAttributeError({
            path: issue.path,
            message: issue.message,
            expected,
            received,
        });

        base.addChild(child);
    }

    return base;
}
