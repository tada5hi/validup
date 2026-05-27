/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { IssueGroup, IssueItem } from '../../src';
import {
    IssueCode,
    defineIssueGroup,
    defineIssueItem,
    isIssueGroup,
    isIssueItem,
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

    it('should preserve user-provided code on issue item', () => {
        const item = defineIssueItem({
            path: ['email'],
            message: 'Email is invalid',
            code: 'email_invalid',
        });

        expect(item.code).toEqual('email_invalid');
    });

    it('should fall back to default code when none provided', () => {
        const item = defineIssueItem({
            path: ['email'],
            message: 'Email is invalid',
        });

        expect(item.code).toEqual(IssueCode.VALUE_INVALID);
    });

    describe('IssueCode vocabulary', () => {
        // The vocabulary is the contract adapters map onto and i18n catalogs
        // translate from. These tests anchor the convention: UPPER_SNAKE keys,
        // lower_snake_case values, no drift between the docs and the const.

        it('exposes every documented code on the const', () => {
            // Regression guard: every code mentioned in the README's Issue
            // Codes table must be reachable on the runtime const. If a code
            // is renamed or removed without updating the test, this catches it.
            const codes = Object.values(IssueCode);
            expect(codes).toContain('value_invalid');
            expect(codes).toContain('one_of_failed');
            expect(codes).toContain('required');
            expect(codes).toContain('min_length');
            expect(codes).toContain('max_length');
            expect(codes).toContain('min_value');
            expect(codes).toContain('max_value');
            expect(codes).toContain('between');
            expect(codes).toContain('alpha');
            expect(codes).toContain('alpha_num');
            expect(codes).toContain('numeric');
            expect(codes).toContain('integer');
            expect(codes).toContain('decimal');
            expect(codes).toContain('email');
            expect(codes).toContain('url');
            expect(codes).toContain('ip_address');
            expect(codes).toContain('mac_address');
            expect(codes).toContain('not_uuid');
            expect(codes).toContain('invalid_date');
            expect(codes).toContain('pattern_mismatch');
            expect(codes).toContain('same_as');
        });

        it('uses lower_snake_case for every runtime code value', () => {
            // Adapters and i18n catalogs key off the runtime string. Anchor the
            // casing so a future PR adding `MyNewCode: 'myNewCode'` would fail
            // here instead of silently shipping the inconsistency.
            const snakeCase = /^[a-z]+(?:_[a-z0-9]+)*$/;
            for (const value of Object.values(IssueCode)) {
                expect(value, `IssueCode value "${value}" must be lower_snake_case`)
                    .toMatch(snakeCase);
            }
        });

        it('aligns const keys 1:1 with their runtime values (UPPER_SNAKE ↔ lower_snake)', () => {
            // Anchors the documented convention — every UPPER_SNAKE key must
            // be the literal-uppercase form of its lower_snake_case value.
            // Catches accidental drift like adding `MyNewCode: 'myNewCode'`.
            for (const [key, value] of Object.entries(IssueCode)) {
                expect(key, `key "${key}" must be the UPPER_SNAKE form of value "${value}"`)
                    .toBe(value.toUpperCase());
            }
        });
    });
});
