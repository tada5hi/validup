/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    IssueCode,
    ValidupError,
    buildOneOfFailedGroup,
    defineIssueItem,
    errorToIssues,
    isIssueGroup,
} from '../../src';

describe('errorToIssues', () => {
    it('spreads a ValidupError\'s issues verbatim', () => {
        const error = new ValidupError([
            defineIssueItem({
                path: ['a'], 
                code: IssueCode.MIN_LENGTH, 
                message: 'too short', 
                params: { min: 3 }, 
            }),
            defineIssueItem({
                path: ['b'], 
                code: IssueCode.PATTERN, 
                message: 'pattern mismatch', 
                params: { pattern: '\\d+' }, 
            }),
        ]);

        const out = errorToIssues(error);
        expect(out).toHaveLength(2);
        expect(out[0]?.path).toEqual(['a']);
        expect(out[1]?.path).toEqual(['b']);
        // Returned array is a fresh copy — mutating it doesn't affect the
        // original ValidupError.issues. Each issue itself is the same
        // reference (callers map/spread before further mutation).
        out.pop();
        expect(error.issues).toHaveLength(2);
    });

    it('synthesizes a single VALUE_INVALID IssueItem from a plain Error', () => {
        const out = errorToIssues(new Error('plain failure'));
        expect(out).toHaveLength(1);
        expect(out[0]?.message).toBe('plain failure');
        expect(out[0]?.code).toBe(IssueCode.VALUE_INVALID);
        expect(out[0]?.path).toEqual([]);
    });

    it('respects the supplied path / code on the synthetic IssueItem', () => {
        const out = errorToIssues(new Error('boom'), {
            path: ['nested', 'field'],
            code: 'custom_code',
        });
        expect(out[0]?.path).toEqual(['nested', 'field']);
        expect(out[0]?.code).toBe('custom_code');
    });

    it('defensively stringifies a non-Error throw', () => {
        const stringThrow = errorToIssues('plain string failure');
        expect(stringThrow[0]?.message).toBe('plain string failure');
        expect(stringThrow[0]?.code).toBe(IssueCode.VALUE_INVALID);

        const objectThrow = errorToIssues({ weird: true });
        expect(objectThrow[0]?.message.startsWith('Non-Error throw:')).toBe(true);

        const nullThrow = errorToIssues(null);
        expect(nullThrow[0]?.message).toBe('Non-Error throw: null');
    });

    it('does NOT apply the supplied code to spread ValidupError issues', () => {
        // ValidupError issues are spread verbatim — their own codes are
        // preserved; the supplied code only fills in the synthetic path.
        const error = new ValidupError([
            defineIssueItem({
                path: ['a'], 
                code: IssueCode.MIN_LENGTH, 
                message: 'short', 
                params: { min: 3 }, 
            }),
        ]);
        const out = errorToIssues(error, { code: 'should_not_apply' });
        expect(out[0]?.code).toBe(IssueCode.MIN_LENGTH);
    });
});

describe('buildOneOfFailedGroup', () => {
    it('wraps branch issues in an IssueGroup with code ONE_OF_FAILED', () => {
        const branches = [
            defineIssueItem({
                path: ['a'], 
                code: IssueCode.VALUE_INVALID, 
                message: 'a failed', 
            }),
            defineIssueItem({
                path: ['b'], 
                code: IssueCode.VALUE_INVALID, 
                message: 'b failed', 
            }),
        ];

        const group = buildOneOfFailedGroup(branches);
        expect(isIssueGroup(group)).toBe(true);
        expect(group.code).toBe(IssueCode.ONE_OF_FAILED);
        expect(group.message).toBe('None of the branches succeeded');
        expect(group.path).toEqual([]);
        expect(group.issues).toHaveLength(2);
    });

    it('respects supplied path + message overrides', () => {
        const group = buildOneOfFailedGroup([], {
            path: ['contact'],
            message: 'Custom — nothing matched',
        });
        expect(group.path).toEqual(['contact']);
        expect(group.message).toBe('Custom — nothing matched');
    });

    it('accepts an empty branch list (zero successes is still zero successes)', () => {
        const group = buildOneOfFailedGroup([]);
        expect(group.code).toBe(IssueCode.ONE_OF_FAILED);
        expect(group.issues).toHaveLength(0);
    });
});
