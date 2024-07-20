/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Validator } from '../../src';
import { Container } from '../../src';

const validator : Validator = async (ctx) : Promise<unknown> => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }

    return ctx.value;
};

const container = new Container<{ foo: string, bar: string, boz: string }>();
container.mount('foo', { group: 'foo' }, validator);
container.mount('bar', { group: ['foo', 'bar'] }, validator);
container.mount('boz', validator);

describe('group', () => {
    it('should execute', async () => {
        let outcome = await container.run({
            foo: 'bar',
            bar: 'baz',
        }, {
            group: 'foo',
        });
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toEqual('baz');

        outcome = await container.run({
            foo: 'bar',
            bar: 'baz',
            boz: 'biz',
        }, {
            group: 'bar',
        });
        expect(outcome.foo).toBeUndefined();
        expect(outcome.bar).toEqual('baz');
        expect(outcome.boz).toBeUndefined();
    });

    it('should work with wildcard group', async () => {
        const outcome = await container.run({
            foo: 'bar',
            bar: 'baz',
            boz: 'biz',
        }, {
            group: '*',
        });
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toEqual('baz');
        expect(outcome.boz).toEqual('biz');
    });

    it('should work without specifying a group', async () => {
        const outcome = await container.run({
            foo: 'bar',
            bar: 'baz',
            boz: 'biz',
        });
        expect(outcome.foo).toBeUndefined();
        expect(outcome.bar).toBeUndefined();
        expect(outcome.boz).toEqual('biz');
    });
});
