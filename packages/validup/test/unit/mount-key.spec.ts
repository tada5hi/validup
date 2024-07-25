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
            pathAbsolute: 'baz.foo.bar',
            pathRaw: 'foo.bar',
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
            pathAbsolute: 'foo',
            pathRaw: 'foo',
            value: 'bar',
        } satisfies Partial<ValidatorContext>);

        expect(output.bar).toMatchObject({
            pathAbsolute: 'bar',
            pathRaw: 'bar',
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
            pathAbsolute: 'foo.bar',
            pathRaw: 'foo.bar',
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
            pathAbsolute: 'foo[1]',
            pathRaw: 'foo[1]',
            value: 'baz',
        } satisfies Partial<ValidatorContext>);
    });

    it('should support key with non existent value', async () => {
        const container = new Container();
        container.mount('foo.bar.baz', ((ctx) => ctx));

        const output = await container.run({}, { flat: true });

        expect(output['foo.bar.baz']).toMatchObject({
            pathAbsolute: 'foo.bar.baz',
            pathRaw: 'foo.bar.baz',
            value: undefined,
        } satisfies Partial<ValidatorContext>);
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
            pathAbsolute: 'foo.foo',
            pathRaw: '**.foo',
            value: 1,
        } satisfies Partial<ValidatorContext>);
        expect(output.foo).toMatchObject({
            pathAbsolute: 'foo',
            pathRaw: '**.foo',
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
            pathAbsolute: 'foo.a.b.bar',
            pathRaw: 'foo.**.bar',
            value: 1,
        } satisfies Partial<ValidatorContext>);
        expect(output['foo.c.bar']).toMatchObject({
            pathAbsolute: 'foo.c.bar',
            pathRaw: 'foo.**.bar',
            value: 2,
        } satisfies Partial<ValidatorContext>);
    });
});
