/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from '../../src';
import { stringValidator } from '../data';

const container = new Container<{ foo: string, bar: string, boz: string }>();
container.mount('foo', { group: 'foo' }, stringValidator);
container.mount('bar', { group: ['foo', 'bar'] }, stringValidator);
container.mount('boz', stringValidator);

describe('group', () => {
    it('should work with explicit group', async () => {
        const outcome = await container.run({
            foo: 'bar',
            bar: 'baz',
            boz: 'biz',
        }, {
            group: 'bar',
        });
        expect(outcome.foo).toBeUndefined();
        expect(outcome.bar).toEqual('baz');
        expect(outcome.boz).toEqual('biz');
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
