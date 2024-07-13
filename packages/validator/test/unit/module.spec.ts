/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidationNestedError, Validator } from 'validup';
import { createRunner } from '../../src';
import { UserValidator } from '../data/user';

describe('src/module', () => {
    it('should validate extended validator', async () => {
        const validator = new UserValidator();

        const outcome = await validator.run({
            data: {
                name: 'Peter',
                age: 28,
                password: '1234',
                foo: 'bar',
            },
        });

        expect(outcome).toBeDefined();
        expect(outcome.name).toEqual('Peter');
        expect(outcome.age).toEqual(28);
        expect(outcome.password).toEqual('1234');
        expect((outcome as Record<string, any>).foo).toBeUndefined();
    });

    it('should validate', async () => {
        const validator = new Validator();
        validator.mountRunner('foo', createRunner((chain) => chain.isArray({ min: 1, max: 10 })));

        const outcome = await validator.run({
            data: {
                foo: [1],
            },
        });

        expect(outcome.foo).toEqual([1]);
    });

    it('should not validate', async () => {
        const validator = new Validator();
        validator.mountRunner('foo', createRunner((chain) => chain.isArray({ min: 1, max: 10 })));

        expect.assertions(3);

        try {
            await validator.run({
                data: {
                    foo: [],
                },
            });
        } catch (e) {
            if (e instanceof ValidationNestedError) {
                expect(e.children).toBeDefined();
                expect(e.children).toHaveLength(1);
                expect(e.children[0].path).toEqual(['foo']);
            }
        }
    });
});
