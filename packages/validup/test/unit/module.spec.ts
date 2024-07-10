/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Validator } from '../../src';
import { UserValidator } from '../data/user';

describe('src/module', () => {
    it('should validate', async () => {
        const validator = new Validator<{ foo: string, bar: string }>();

        const fooChain = validator.createChain('foo')
            .isString();
        validator.register(fooChain);

        const outcome = await validator.execute({
            body: {
                foo: 'bar',
            },
        });
        expect(outcome).toBeDefined();
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toBeUndefined();
    });

    it('should validate empty request', async () => {
        const validator = new Validator();
        const outcome = await validator.execute({});
        expect(outcome).toBeDefined();
    });

    it('should validate groups', async () => {
        const validator = new Validator<{ foo: string, bar: string }>();

        const fooChain = validator.createChain('foo')
            .isString();
        validator.register(fooChain, { group: 'foo' });

        const barChain = validator.createChain('bar')
            .isString();

        validator.register(barChain, { group: ['foo', 'bar'] });

        let outcome = await validator.execute({
            body: {
                foo: 'bar',
                bar: 'baz',
            },
        }, { group: 'foo' });
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toEqual('baz');

        outcome = await validator.execute({
            body: {
                foo: 'bar',
                bar: 'baz',
            },
        }, { group: 'bar' });
        expect(outcome.foo).toBeUndefined();
        expect(outcome.bar).toEqual('baz');
    });

    it('should validate with defaults', async () => {
        const validator = new Validator<{ foo: string }>();
        validator.register(validator.createChain('foo')
            .optional({ values: 'null' })
            .isNumeric()
            .default('bar'));

        let outcome = await validator.execute({});
        expect(outcome.foo).toBeUndefined();

        outcome = await validator.execute({}, {
            defaults: {
                foo: 'boz',
            },
        });
        expect(outcome.foo).toEqual('boz');
    });

    it('should validate extended validator', async () => {
        const validator = new UserValidator();

        const outcome = await validator.execute({
            body: {
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

    it('should not validate', async () => {
        const validator = new Validator<{ foo: string }>();
        validator.register(validator.createChain('foo')
            .exists()
            .notEmpty()
            .isNumeric());

        expect.assertions(2);

        try {
            await validator.execute({});
        } catch (e: any) {
            expect(e).toBeDefined();
            expect(e.children).toHaveLength(1);
        }
    });
});
