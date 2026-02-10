/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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
});
