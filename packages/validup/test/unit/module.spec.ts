/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Runner } from '../../src';
import { Validator } from '../../src';

describe('src/module', () => {
    it('should validate', async () => {
        const validator = new Validator<{ foo: string, bar: string }>();

        const chain : Runner = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value !== 'string') {
                throw new Error('Value is not a string');
            }

            return ctx.value;
        };

        validator.mountRunner('foo', chain);

        const outcome = await validator.run({
            data: {
                foo: 'bar',
            },
        });
        expect(outcome).toBeDefined();
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toBeUndefined();
    });

    it('should validate empty request', async () => {
        const validator = new Validator();
        const outcome = await validator.run({});
        expect(outcome).toBeDefined();
    });

    it('should validate groups', async () => {
        const validator = new Validator<{ foo: string, bar: string }>();

        const fooChain : Runner = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value !== 'string') {
                throw new Error('Value is not a string');
            }

            return ctx.value;
        };
        validator.mountRunner('foo', fooChain, { group: 'foo' });

        const barChain : Runner = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value !== 'string') {
                throw new Error('Value is not a string');
            }

            return ctx.value;
        };

        validator.mountRunner('bar', barChain, { group: ['foo', 'bar'] });

        let outcome = await validator.run({
            data: {
                foo: 'bar',
                bar: 'baz',
            },
            group: 'foo',
        });
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toEqual('baz');

        outcome = await validator.run({
            data: {
                foo: 'bar',
                bar: 'baz',
            },
            group: 'bar',
        });
        expect(outcome.foo).toBeUndefined();
        expect(outcome.bar).toEqual('baz');
    });

    it('should validate with defaults', async () => {
        const validator = new Validator<{ foo: string }>();

        const chain : Runner = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value === 'undefined') {
                return undefined;
            }

            if (typeof ctx.value !== 'number') {
                throw new Error('The value is invalid.');
            }

            return ctx.value;
        };

        validator.mountRunner('foo', chain);

        let outcome = await validator.run({});
        expect(outcome.foo).toBeUndefined();

        outcome = await validator.run({
            defaults: {
                foo: 'boz',
            },
        });
        expect(outcome.foo).toEqual('boz');
    });

    it('should not validate', async () => {
        const validator = new Validator<{ foo: string }>();
        const chain : Runner = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value === 'undefined' || typeof ctx.value !== 'number') {
                throw new Error('The value is invalid.');
            }

            return ctx.value;
        };

        validator.mountRunner('foo', chain);

        expect.assertions(2);

        try {
            await validator.run({});
        } catch (e: any) {
            expect(e).toBeDefined();

            expect(e.children).toHaveLength(1);
        }
    });
});
