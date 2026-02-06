/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container, ValidupError } from '../../src';
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

    it('should not work with truthy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({
            oneOf: true,
        });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        expect.assertions(1);

        try {
            await container.run({
                foo: 1,
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not work falsy oneOf option', async () => {
        const container = new Container<{ foo: string, bar: string }>({
            oneOf: false,
        });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        expect.assertions(2);

        try {
            await container.run({
                foo: 'boz',
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);

                const [issue] = e.issues;
                if (issue.type === 'item') {
                    expect(issue.path).toEqual(['bar']);
                }
            }
        }
    });
});
