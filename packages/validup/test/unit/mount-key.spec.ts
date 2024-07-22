/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from '../../src';

describe('module/mount-key', () => {
    it('should support nested key with dot notation', async () => {
        const container = new Container();
        container.mount('foo.bar', ((ctx) => ctx));

        const output = await container.run({
            foo: {
                bar: 1,
            },
        }, {
            flat: true,
        });

        expect(output['foo.bar']).toMatchObject({
            path: 'foo.bar',
            pathRaw: 'foo.bar',
            value: 1,
        });
    });

    it('should support key with square brackets notation', async () => {
        const container = new Container();
        container.mount('foo[1]', ((ctx) => ctx));

        const output = await container.run({
            foo: ['bar', 'baz'],
        }, {
            flat: true,
        });

        expect(output['foo[1]']).toMatchObject({
            path: 'foo[1]',
            pathRaw: 'foo[1]',
            value: 'baz',
        });
    });

    it('should support key with non existent value', async () => {
        const container = new Container();
        container.mount('foo.bar.baz', ((ctx) => ctx));

        const output = await container.run({}, { flat: true });

        expect(output['foo.bar.baz']).toMatchObject({
            path: 'foo.bar.baz',
            pathRaw: 'foo.bar.baz',
            value: undefined,
        });
    });

    it('should support primitive key property', async () => {
        const container = new Container();
        container.mount('foo.toFixed', ((ctx) => ctx));

        const output = await container.run({
            foo: 1,
        });

        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should support glob star pattern', async () => {
        const container = new Container();
        container.mount('**.foo', ((ctx) => ctx));

        const output = await container.run({
            foo: {
                foo: 1,
            },
        }, {
            flat: true,
        });

        expect(output['foo.foo']).toMatchObject({
            path: 'foo.foo',
            pathRaw: '**.foo',
            value: 1,
        });
        expect(output.foo).toMatchObject({
            path: 'foo',
            pathRaw: '**.foo',
            value: { foo: 1 },
        });
    });

    it('should support deeply nested pattern with glob star', async () => {
        const container = new Container();
        container.mount('foo.**.bar', ((ctx) => ctx));

        const output = await container.run({
            foo: {
                a: {
                    b: {
                        bar: 1,
                    },
                },
                c: {
                    bar: 2,
                },
            },
        }, {
            flat: true,
        });

        expect(output['foo.a.b.bar']).toMatchObject({
            path: 'foo.a.b.bar',
            pathRaw: 'foo.**.bar',
            value: 1,
        });
        expect(output['foo.c.bar']).toMatchObject({
            path: 'foo.c.bar',
            pathRaw: 'foo.**.bar',
            value: 2,
        });
    });
});
