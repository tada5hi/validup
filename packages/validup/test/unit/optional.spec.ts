/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
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

        const output = await parent.run({ child: null });
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

        const output = await parent.run({ child: null });
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

        const output = await parent.run({ child: '' });
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

        const output = await parent.run({ child: '' });
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
            await parent.run({ child: null });
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
            await parent.run({ child: '' });
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
            await parent.run({ child: ' ' });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should treat empty string as missing via predicate while keeping 0', async () => {
        // Predicate use case the FALSY enum can't express: drop empty strings,
        // keep numeric zeros (0 must reach the validator).
        const container = new Container<{ name: string, count: number }>();
        container.mount(
            'name',
            { optional: (v) => v === '' || typeof v === 'undefined' },
            stringValidator,
        );
        container.mount('count', (ctx) => {
            if (typeof ctx.value !== 'number') {
                throw new Error('Value is not a number');
            }
            return ctx.value;
        });

        const output = await container.run({ name: '', count: 0 });
        expect(output.name).toBeUndefined();
        expect(output.count).toEqual(0);
    });

    it('should pass through optionalInclude with a predicate', async () => {
        const container = new Container<{ tag: string }>();
        container.mount(
            'tag',
            { optional: (v) => typeof v !== 'string', optionalInclude: true },
            stringValidator,
        );

        const output = await container.run({ tag: 42 } as any);
        expect(output.tag).toEqual(42);
    });
});
