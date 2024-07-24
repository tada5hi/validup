/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from '../../src';
import { stringValidator } from '../data';

describe('oneOf', () => {
    it('should execute only specific mount item', async () => {
        const container = new Container<{ foo: string, bar: string }>({
            pathsToInclude: ['foo'],
        });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({
            foo: 'boz',
            bar: 'baz',
        });

        expect(output.foo).toEqual('boz');
        expect(output.bar).toBeUndefined();
    });

    it('should not execute any mount item', async () => {
        const container = new Container<{ foo: string, bar: string }>({
            pathsToInclude: [],
        });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({
            foo: 'boz',
            bar: 'baz',
        });

        expect(output.foo).toBeUndefined();
        expect(output.bar).toBeUndefined();
    });
});
