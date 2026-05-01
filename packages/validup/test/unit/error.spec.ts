/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { ValidupError, defineIssueGroup, isValidupError } from '../../src';

describe('error', () => {
    it('should verify error', () => {
        const error = new ValidupError();

        expect(isValidupError(error)).toBeTruthy();
    });

    it('should verify error similar shape', () => {
        const error = new Error();
        (error as Record<string, any>).issues = [
            defineIssueGroup({
                message: 'foo',
                issues: [],
                path: [],
            }),
        ];

        expect(isValidupError(error)).toBeTruthy();
    });

    it('should not verify error', () => {
        const error = new Error();

        expect(isValidupError(error)).toBeFalsy();
    });

    it('should expose an ebec-style code on ValidupError', () => {
        const error = new ValidupError();

        expect(error.code).toEqual('VALIDUP_ERROR');
    });

    it('should serialize via toJSON including issues', () => {
        const error = new ValidupError([
            defineIssueGroup({
                message: 'foo',
                issues: [],
                path: ['foo'],
            }),
        ]);

        const serialized = error.toJSON();
        expect(serialized.name).toEqual('ValidupError');
        expect(serialized.code).toEqual('VALIDUP_ERROR');
        expect(serialized.issues).toHaveLength(1);
        expect(serialized.issues[0]).toMatchObject({ type: 'group', message: 'foo' });
    });
});
