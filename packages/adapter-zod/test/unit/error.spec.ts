/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Container, ValidupError, defineIssueItem, isValidupError,
} from 'validup';
import { z } from 'zod';
import { buildZodIssuesForError, createValidator } from '../../src';

describe('error', () => {
    it('should create zod issues', () => {
        const error = new ValidupError([
            defineIssueItem({
                message: 'The validation failed',
                path: ['foo'],
            }),
        ]);

        const zodIssues = buildZodIssuesForError(error);
        expect(zodIssues).toHaveLength(1);
    });

    it('should wrap error as zod issue', async () => {
        const childContainer = new Container();
        childContainer.mount('bar', createValidator(z.string()));

        const container = new Container<{foo: string}>();
        container.mount('foo', createValidator(
            z
                .any()
                .check(async (ctx) => {
                    try {
                        await childContainer.run({
                            bar: ctx.value,
                        });
                    } catch (e) {
                        if (isValidupError(e)) {
                            ctx.issues.push(...buildZodIssuesForError(e));
                        }
                    }
                }),
        ));

        expect.assertions(2);

        const output = await container.safeRun({ foo: 1 });
        expect(output.success).toBeFalsy();
        if (!output.success) {
            expect(output.error).toBeInstanceOf(ValidupError);
        }
    });
});
