/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container, OptionalValue } from '../../src';
import { stringValidator } from '../data';

describe('optional', () => {
    it('should work with default optionalValue', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true },
            child,
        );

        const output = await parent.run({});
        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should work with default optionalValue and optionalInclude', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            {
                optional: true,
                optionalValue: OptionalValue.UNDEFINED,
                optionalInclude: true,
            },
            child,
        );

        const output = await parent.run({});
        expect(Object.keys(output)).toHaveLength(1);
        expect(output.child).toBeUndefined();
    });

    it('should work with null optionalValue', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.NULL },
            child,
        );

        const output = await parent.run({
            child: null,
        });
        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should work with null optionalValue and optionalInclude', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            {
                optional: true,
                optionalValue: OptionalValue.NULL,
                optionalInclude: true,
            },
            child,
        );

        const output = await parent.run({
            child: null,
        });
        expect(Object.keys(output)).toHaveLength(1);
        expect(output.child).toEqual(null);
    });

    it('should work with falsy optionalValue', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.FALSY },
            child,
        );

        const output = await parent.run({
            child: '',
        });
        expect(Object.keys(output)).toHaveLength(0);
    });

    it('should work with falsy optionalValue and optionalInclude', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            {
                optional: true,
                optionalValue: OptionalValue.FALSY,
                optionalInclude: true,
            },
            child,
        );

        const output = await parent.run({
            child: '',
        });
        expect(Object.keys(output)).toHaveLength(1);
        expect(output.child).toEqual('');
    });

    it('should not work with default optionalValue and invalid value', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true },
            child,
        );

        expect.assertions(1);

        try {
            await parent.run({
                child: null,
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not work with null optionalValue and invalid value', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.NULL },
            child,
        );

        expect.assertions(1);

        try {
            await parent.run({
                child: '',
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not work with falsy optionalValue and invalid value', async () => {
        const child = new Container<{ foo: string }>();
        child.mount('foo', stringValidator);

        const parent = new Container();
        parent.mount(
            'child',
            { optional: true, optionalValue: OptionalValue.FALSY },
            child,
        );

        expect.assertions(1);

        try {
            await parent.run({
                child: ' ',
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });
});
