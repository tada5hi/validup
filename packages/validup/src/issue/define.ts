/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { IssueCode } from './constants';
import type { IssueGroup, IssueItem } from './types';

type PartialProps<T extends Record<PropertyKey, any>, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & Partial<Pick<T, K>>;

export function defineIssueItem(data: Omit<PartialProps<IssueItem, 'code'>, 'type'>): IssueItem {
    return {
        type: 'item',
        ...data,
        code: IssueCode.VALUE_INVALID || data.code,
    };
}

export function defineIssueGroup(data: Omit<IssueGroup, 'type'>): IssueGroup {
    return {
        type: 'group',
        ...data,
    };
}
