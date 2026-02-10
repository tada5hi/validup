/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import type {
    Issue, IssueBase, IssueGroup, IssueItem,
} from './types';

function isIssuePath(input: unknown) : input is PropertyKey[] {
    if (!Array.isArray(input)) {
        return false;
    }

    return input.every((el) => typeof el === 'string' ||
    typeof el === 'number' ||
    typeof el === 'symbol');
}

function isBaseIssue(input: unknown) : input is IssueBase & {[ke: string]: any} {
    if (!isObject(input)) {
        return false;
    }

    if (typeof input.message !== 'string') {
        return false;
    }

    if (!isIssuePath(input.path)) {
        return false;
    }

    return typeof input.meta === 'undefined' ||
        isObject(input.meta);
}

export function isIssueItem(input: unknown) : input is IssueItem {
    if (!isBaseIssue(input)) {
        return false;
    }

    if (input.type !== 'item') {
        return false;
    }

    return typeof input.code === 'string';
}

export function isIssueGroup(input: unknown) : input is IssueGroup {
    if (!isBaseIssue(input)) {
        return false;
    }

    if (input.type !== 'group') {
        return false;
    }

    return Array.isArray(input.issues) &&
        input.issues.every((issue) => isIssueItem(issue) || isIssueGroup(issue));
}

export function isIssue(input: unknown) : input is Issue {
    return isIssueGroup(input) || isIssueItem(input);
}
