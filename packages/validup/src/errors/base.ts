/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Issue } from '../issue';

export class ValidupError extends Error {
    readonly issues: Issue[];

    constructor(issues: Issue[] = []) {
        super(JSON.stringify(
            issues,
            (_: string, value: any) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }

                return value;
            },
            2,
        ));

        this.issues = issues;
    }
}
