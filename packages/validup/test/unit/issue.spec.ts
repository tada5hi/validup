/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IssueGroup, IssueItem } from '../../src';
import {
    defineIssueGroup, defineIssueItem, isIssueGroup, isIssueItem,
} from '../../src';

describe('issue', () => {
    it('should verify issue item', () => {
        const input : IssueItem = defineIssueItem({
            path: [],
            message: 'foo',
            code: 'bar',
        });

        expect(isIssueItem(input)).toBeTruthy();
    });

    it('should not verify issue item (missing type)', () => {
        const input : Partial<IssueItem> = {
            path: [],
            message: 'foo',
            code: 'bar',
        };

        expect(isIssueItem(input)).toBeFalsy();
    });

    it('should not verify issue item (missing path)', () => {
        const input : Partial<IssueItem> = {
            type: 'item',
            message: 'foo',
            code: 'bar',
        };

        expect(isIssueItem(input)).toBeFalsy();
    });

    it('should not verify issue item (missing message)', () => {
        const input : Partial<IssueItem> = {
            type: 'item',
            path: [],
            code: 'bar',
        };

        expect(isIssueItem(input)).toBeFalsy();
    });

    it('should not verify issue item (missing code)', () => {
        const input : Partial<IssueItem> = {
            type: 'item',
            path: [],
            message: 'foo',
        };

        expect(isIssueItem(input)).toBeFalsy();
    });

    it('should verify issue group', () => {
        const input = defineIssueGroup({
            path: [],
            message: 'foo',
            issues: [
                defineIssueGroup({
                    path: [],
                    message: 'bar',
                    issues: [
                        defineIssueItem({
                            code: 'foo',
                            message: 'bar',
                            path: [],
                        }),
                    ],
                }),
                defineIssueItem({
                    code: 'baz',
                    message: 'boz',
                    path: [],
                }),
            ],
        });

        expect(isIssueGroup(input)).toBeTruthy();
    });

    it('should not verify issue group (missing type)', () => {
        const input : Partial<IssueGroup> = {
            path: [],
            message: 'foo',
            code: 'bar',
            issues: [],
        };

        expect(isIssueGroup(input)).toBeFalsy();
    });

    it('should not verify issue group (missing issues)', () => {
        const input : Partial<IssueGroup> = {
            type: 'group',
            path: [],
            message: 'foo',
            code: 'bar',
        };

        expect(isIssueGroup(input)).toBeFalsy();
    });
});
