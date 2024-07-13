/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { z } from 'zod';
import { ValidationNestedError, Validator } from 'validup';
import { createRunner } from '../../src';

describe('src/module', () => {
    it('should validate', async () => {
        const validator = new Validator<{ email: string }>();

        validator.mountRunner('email', createRunner(z.string().email()));

        const outcome = await validator.run({
            data: {
                email: 'foo@example.com',
            },
        });

        expect(outcome).toBeDefined();
        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should not validate', async () => {
        const validator = new Validator<{ email: string }>();

        validator.mountRunner('email', createRunner(z.string().email()));

        expect.assertions(4);

        try {
            await validator.run({
                data: {
                    email: 'foo',
                },
            });
        } catch (e) {
            if (e instanceof ValidationNestedError) {
                expect(e.children).toBeDefined();
                expect(e.children).toHaveLength(1);
                expect(e.children[0].message).toEqual('Invalid email');
                expect(e.children[0].path).toEqual(['email']);
            }
        }
    });

    it('should not validate array', async () => {
        const validator = new Validator<{ foo: unknown[] }>();

        validator.mountRunner('foo', createRunner(z.object({
            bar: z.string().array().min(2),
        })));

        expect.assertions(6);

        try {
            await validator.run({
                data: {
                    foo: {
                        bar: [0],
                    },
                },
            });
        } catch (e) {
            if (e instanceof ValidationNestedError) {
                expect(e.children).toBeDefined();
                expect(e.children).toHaveLength(2);

                expect(e.children[0].message).toEqual('Array must contain at least 2 element(s)');
                expect(e.children[0].path).toEqual(['foo.bar']);

                expect(e.children[1].message).toEqual('Expected string, received number');
                expect(e.children[1].path).toEqual(['foo.bar[0]']);
            }
        }
    });
});
