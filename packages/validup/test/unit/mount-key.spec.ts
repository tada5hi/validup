/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidatorContext } from '../../src';
import { Container } from '../../src';

describe('module/mount-key', () => {
    it('should mount nested container', async () => {
        const childContainer = new Container();
        childContainer.mount('foo.bar', ((ctx) => ctx));

        const container = new Container();
        container.mount('baz', childContainer);

        const output = await container.run({
            baz: {
                foo: {
                    bar: 1,
                },
            },
        }, {
            flat: true,
        });

        expect(output['baz.foo.bar']).toMatchObject({
            path: ['baz', 'foo', 'bar'],
            value: 1,
        } satisfies Partial<ValidatorContext>);
    });

    it('should mount container on same level', async () => {
        const childContainer = new Container();
        childContainer.mount('foo', ((ctx) => ctx));

        const container = new Container();
        container.mount('bar', ((ctx) => ctx));
        container.mount(childContainer);

        const output = await container.run({
            foo: 'bar',
            bar: 'baz',
        });

        expect(output.foo).toMatchObject({
            path: ['foo'],
            value: 'bar',
        } satisfies Partial<ValidatorContext>);

        expect(output.bar).toMatchObject({
            path: ['bar'],
            value: 'baz',
        } satisfies Partial<ValidatorContext>);
    });

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
            path: ['foo', 'bar'],
            value: 1,
        } satisfies Partial<ValidatorContext>);
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
            path: ['foo', 1],
            value: 'baz',
        } satisfies Partial<ValidatorContext>);
    });

    it('should support key with non existent value', async () => {
        const container = new Container();
        container.mount('foo.bar.baz', ((ctx) => ctx));

        const output = await container.run({}, { flat: true });

        expect(output['foo.bar.baz']).toMatchObject({
            path: ['foo', 'bar', 'baz'],
            value: undefined,
        } satisfies Partial<ValidatorContext>);
    });

    it('should support primitive key property', async () => {
        const container = new Container();
        container.mount('foo.toFixed', ((ctx) => ctx));

        const output = await container.run({
            foo: 1,
        });

        expect(output.foo.toFixed).toMatchObject({
            path: ['foo', 'toFixed'],
            value: expect.any(Function),
        } satisfies Partial<ValidatorContext>);
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
            path: ['foo', 'foo'],
            value: 1,
        } satisfies Partial<ValidatorContext>);
        expect(output.foo).toMatchObject({
            path: ['foo'],
            value: { foo: 1 },
        } satisfies Partial<ValidatorContext>);
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
            path: ['foo', 'a', 'b', 'bar'],
            value: 1,
        } satisfies Partial<ValidatorContext>);
        expect(output['foo.c.bar']).toMatchObject({
            path: ['foo', 'c', 'bar'],
            value: 2,
        } satisfies Partial<ValidatorContext>);
    });
});
