/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Issue, IssueInput } from './types';
import { IssueCode, IssueSeverity } from './constants';

export function defineIssue(input: IssueInput) : Issue {
    return {
        ...input,
        code: input.code || IssueCode.CUSTOM,
        severity: input.severity || IssueSeverity.ERROR,
        issues: input.issues || [],
    };
}
