/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    defineValidator,
    isValidatorDescriptor,
} from '../../src';

describe('src/validator/define', () => {
    it('returns the descriptor unchanged from defineValidator', () => {
        const descriptor = defineValidator({
            sideEffect: true,
            run: (ctx) => ctx.value,
        });
        expect(descriptor.sideEffect).toBe(true);
        expect(typeof descriptor.run).toBe('function');
    });

    it('isValidatorDescriptor recognises a descriptor and rejects look-alikes', () => {
        expect(isValidatorDescriptor(defineValidator({ run: (ctx) => ctx.value }))).toBe(true);
        // Bare function: not a descriptor.
        expect(isValidatorDescriptor((ctx: any) => ctx.value)).toBe(false);
        // Plain object without `run`: not a descriptor.
        expect(isValidatorDescriptor({ foo: 1 })).toBe(false);
        // Has `run` AND `safeRun` — looks like a Container, not a descriptor.
        expect(isValidatorDescriptor({ run: () => {}, safeRun: () => {} })).toBe(false);
        // Non-objects.
        expect(isValidatorDescriptor(null)).toBe(false);
        expect(isValidatorDescriptor('run')).toBe(false);
    });

    it('mounts a descriptor and runs its `run` function', async () => {
        const container = new Container<{ foo: string }>();
        container.mount('foo', defineValidator({
            run: (ctx) => {
                if (typeof ctx.value !== 'string') {
                    throw new Error('Value is not a string');
                }
                return ctx.value;
            },
        }));

        const out = await container.run({ foo: 'bar' });
        expect(out.foo).toBe('bar');
    });

    it('still accepts a bare function (back-compat)', async () => {
        const container = new Container<{ foo: string }>();
        container.mount('foo', (ctx) => ctx.value as string);

        const out = await container.run({ foo: 'bar' });
        expect(out.foo).toBe('bar');
    });

    it('accepts a descriptor under the (key, options, data) signature', async () => {
        const container = new Container<{ foo: string }>();
        container.mount(
            'foo',
            { group: 'create' },
            defineValidator({ run: (ctx) => ctx.value }),
        );

        const out = await container.run({ foo: 'bar' }, { group: 'create' });
        expect(out.foo).toBe('bar');
    });
});
