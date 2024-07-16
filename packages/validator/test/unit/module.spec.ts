/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container, ValidupNestedError } from 'validup';
import { createValidator } from '../../src';
import { UserValidator } from '../data/user';

describe('src/module', () => {
    it('should validate extended validator', async () => {
        const validator = new UserValidator();

        const outcome = await validator.run({
            name: 'Peter',
            age: 28,
            password: '1234',
            foo: 'bar',
        });

        expect(outcome).toBeDefined();
        expect(outcome.name).toEqual('Peter');
        expect(outcome.age).toEqual(28);
        expect(outcome.password).toEqual('1234');
        expect((outcome as Record<string, any>).foo).toBeUndefined();
    });

    it('should validate', async () => {
        const validator = new Container();
        validator.mount('foo', createValidator((chain) => chain.isArray({ min: 1, max: 10 })));

        const outcome = await validator.run({
            foo: [1],
        });

        expect(outcome.foo).toEqual([1]);
    });

    it('should not validate', async () => {
        const validator = new Container();
        validator.mount('foo', createValidator((chain) => chain.isArray({ min: 1, max: 10 })));

        expect.assertions(3);

        try {
            await validator.run({
                foo: [],
            });
        } catch (e) {
            if (e instanceof ValidupNestedError) {
                expect(e.children).toBeDefined();
                expect(e.children).toHaveLength(1);
                expect(e.children[0].path).toEqual('foo');
            }
        }
    });
});
