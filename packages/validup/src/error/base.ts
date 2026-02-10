/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { buildErrorMessageForAttributes, stringifyPath } from '../helpers';
import type { Issue } from '../issue';

export class ValidupError extends Error {
    readonly issues: Issue[];

    constructor(issues: Issue[] = []) {
        const paths = issues.map((issue) => stringifyPath(issue.path));
        super(buildErrorMessageForAttributes(paths));

        this.issues = issues;
    }
}
