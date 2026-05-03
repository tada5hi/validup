/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BaseError } from '@ebec/core';
import { buildErrorMessageForAttributes, stringifyPath } from '../helpers';
import type { Issue } from '../issue';

export class ValidupError extends BaseError {
    readonly issues: Issue[];

    constructor(issues: Issue[] = []) {
        const paths = issues.map((issue) => stringifyPath(issue.path));
        super({ message: buildErrorMessageForAttributes(paths) });

        this.issues = issues;
    }

    override toJSON(): ReturnType<BaseError['toJSON']> & { issues: Issue[] } {
        return {
            ...super.toJSON(),
            issues: this.issues,
        };
    }
}
