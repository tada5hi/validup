/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidationError } from 'express-validator/lib/base';
import type { Issue } from 'validup';
import { defineIssueItem } from 'validup';

function buildIssuesForError(
    error: ValidationError,
) : Issue[] {
    const output : Issue[] = [];
    switch (error.type) {
        case 'field': {
            output.push(defineIssueItem({
                path: error.path ? [error.path] : [],
                received: error.value,
                message: error.msg,
            }));
            break;
        }
        case 'alternative': {
            for (let i = 0; i < error.nestedErrors.length; i++) {
                output.push(...buildIssuesForError(error.nestedErrors[i]));
            }
            break;
        }
        case 'alternative_grouped': {
            for (let i = 0; i < error.nestedErrors.length; i++) {
                for (let j = 0; j < error.nestedErrors[i].length; j++) {
                    output.push(...buildIssuesForError(error.nestedErrors[i][j]));
                }
            }
        }
    }

    return output;
}

export function buildIssuesForErrors(
    errors: ValidationError[],
): Issue[] {
    const issues : Issue[] = [];
    for (let i = 0; i < errors.length; i++) {
        issues.push(...buildIssuesForError(errors[i]));
    }

    return issues;
}
