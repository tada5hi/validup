/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { z } from 'zod';
import {
    Container,
    ValidupError,
} from 'validup';
import { createValidator } from '../../src';

describe('src/module', () => {
    it('should validate', async () => {
        const validator = new Container<{ email: string }>();

        validator.mount('email', createValidator(z.string().email()));

        const outcome = await validator.run({
            email: 'foo@example.com',
        });

        expect(outcome).toBeDefined();
        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should validate with validator fn', async () => {
        const validator = new Container<{ email: string }>();

        validator.mount('email', createValidator(() => z.string().email()));

        const outcome = await validator.run({
            email: 'foo@example.com',
        });

        expect(outcome).toBeDefined();
        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should not validate', async () => {
        const validator = new Container<{ email: string }>();

        validator.mount('email', createValidator(z.string().email()));

        expect.assertions(3);

        try {
            await validator.run({
                email: 'foo',
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].message).toEqual('Invalid email address');
                expect(e.issues[0].path).toEqual(['email']);
            }
        }
    });

    it('should not validate nested container', async () => {
        const child = new Container<{ email: string }>();
        child.mount('email', createValidator(z.string().email()));

        const parent = new Container<{child: { email: string }}>();
        parent.mount('child', child);

        expect.assertions(2);

        try {
            await parent.run({
                child: {
                    email: 'foo',
                },
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].path).toEqual(['child', 'email']);
            }
        }
    });

    it('should not validate nested container with empty child mount path', async () => {
        const child = new Container<{ email: string }>();
        child.mount('email', createValidator(z.string().email()));

        const parent = new Container<{child: { email: string }}>();
        parent.mount(child);

        expect.assertions(2);

        try {
            await parent.run({
                child: {
                    email: 'foo',
                },
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].path).toEqual(['email']);
            }
        }
    });

    it('should not validate array', async () => {
        const validator = new Container<{ foo: unknown[] }>();

        validator.mount('foo', createValidator(z.object({
            bar: z.string().array().min(2),
        })));

        expect.assertions(5);

        try {
            await validator.run({
                foo: {
                    bar: [0],
                },
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(2);

                expect(e.issues[0].message).toEqual('Invalid input: expected string, received number');
                expect(e.issues[0].path).toEqual(['foo', 'bar', 0]);

                expect(e.issues[1].message).toEqual('Too small: expected array to have >=2 items');
                expect(e.issues[1].path).toEqual(['foo', 'bar']);
            }
        }
    });
});
