/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from '../../src';
import { stringValidator } from '../data';

describe('oneOf', () => {
    it('should work with truthy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({
            oneOf: true,
        });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({
            foo: 'boz',
        });

        expect(output.foo).toEqual('boz');
        expect(output.bar).toBeUndefined();
    });

    it('should not work falsy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({
            oneOf: false,
        });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        expect.assertions(1);

        try {
            await container.run({
                foo: 'boz',
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });
});
