/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import { Container } from '../../src';

describe('src/module', () => {
    it('should validate', async () => {
        const container = new Container<{ foo: string, bar: string }>();

        const validator : Validator = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value !== 'string') {
                throw new Error('Value is not a string');
            }

            return ctx.value;
        };

        container.mount('foo', validator);

        const outcome = await container.run({ foo: 'bar' });
        expect(outcome).toBeDefined();
        expect(outcome.foo).toEqual('bar');
        expect(outcome.bar).toBeUndefined();
    });

    it('should validate empty request', async () => {
        const container = new Container();
        const outcome = await container.run({});
        expect(outcome).toBeDefined();
    });

    it('should validate with defaults', async () => {
        const container = new Container<{ foo: string }>();

        const chain : Validator = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value === 'undefined') {
                return undefined;
            }

            if (typeof ctx.value !== 'number') {
                throw new Error('The value is invalid.');
            }

            return ctx.value;
        };

        container.mount('foo', chain);

        let outcome = await container.run({});
        expect(outcome.foo).toBeUndefined();

        outcome = await container.run({}, { defaults: { foo: 'boz' } });
        expect(outcome.foo).toEqual('boz');
    });

    it('should forward sliced defaults into nested containers', async () => {
        const childOptionsSeen: any[] = [];
        const child = {
            run: (async (input: any, opts: any = {}) => {
                childOptionsSeen.push(opts);
                return input;
            }),
            safeRun: (async () => ({ success: true, data: {} })),
        };

        const parent = new Container<{ nested: Record<string, unknown>, top: string }>();
        parent.mount('nested', child as any);

        await parent.run(
            { nested: {} },
            {
                defaults: {
                    'nested.foo': 'x',
                    'nested.deep.bar': 'y',
                    top: 'z',
                } as any,
            },
        );

        expect(childOptionsSeen).toHaveLength(1);
        expect(childOptionsSeen[0].defaults).toEqual({
            foo: 'x',
            'deep.bar': 'y',
        });
    });

    it('should fill nested defaults into the expanded output', async () => {
        const child = new Container<{ foo: string }>();
        const parent = new Container<{ nested: { foo: string } }>();
        parent.mount('nested', child);

        const outcome = await parent.run(
            {},
            { defaults: { 'nested.foo': 'fallback' } as any },
        );

        expect(outcome.nested?.foo).toEqual('fallback');
    });

    it('should not validate', async () => {
        const container = new Container<{ foo: string }>();
        const chain : Validator = async (ctx) : Promise<unknown> => {
            if (typeof ctx.value === 'undefined' || typeof ctx.value !== 'number') {
                throw new Error('The value is invalid.');
            }

            return ctx.value;
        };

        container.mount('foo', chain);

        expect.assertions(3);

        try {
            await container.run({});
        } catch (e: any) {
            expect(e).toBeDefined();
            expect(e.issues).toBeDefined();
            expect(e.issues.length).toBeGreaterThanOrEqual(1);
        }
    });
});
