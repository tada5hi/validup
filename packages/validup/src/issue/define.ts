/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IssueGroup, IssueItem } from './types';

export function defineIssueItem(data: Omit<IssueItem, 'type'>): IssueItem {
    return { type: 'item', ...data };
}

export function defineIssueGroup(data: Omit<IssueGroup, 'type'>): IssueGroup {
    return { type: 'group', ...data };
}
