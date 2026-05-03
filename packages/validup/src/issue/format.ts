/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { interpolate } from '@ebec/core';
import type { IssueCode } from './constants';
import type { Issue } from './types';

/**
 * Map of issue `code` → message template. Templates use `{name}` placeholders
 * — the same syntax `@ebec/core`'s `interpolate` understands — and are
 * resolved against `Issue.params` at format time.
 *
 * ```ts
 * const de: IssueMessageTemplates = {
 *     value_invalid: 'Wert ist ungültig',
 *     one_of_failed: 'Keine der Varianten war erfolgreich',
 * };
 * ```
 */
export type IssueMessageTemplates = Partial<Record<IssueCode, string>> & Record<string, string>;

/**
 * Render an issue's user-facing message.
 *
 * Resolution order:
 * 1. If `templates[code]` exists, return `interpolate(template, issue.params)`.
 * 2. Else return `issue.message` (the default English rendering set at
 *    construction time).
 * 3. Else return `fallback`.
 */
export function formatIssue(
    issue: Issue,
    templates?: IssueMessageTemplates,
    fallback: string = '',
): string {
    if (templates && issue.code) {
        const template = templates[issue.code];
        if (typeof template === 'string') {
            return interpolate(template, issue.params || {});
        }
    }
    if (typeof issue.message === 'string' && issue.message.length > 0) {
        return issue.message;
    }
    return fallback;
}

// Re-export ebec's `interpolate` so consumers writing custom formatters don't
// need a direct dependency on `@ebec/core`. Same `{name}` placeholder syntax.
export { interpolate } from '@ebec/core';
