/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import { Container, ValidupError } from '../../src';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }
    return ctx.value;
};

const isNumber: Validator = (ctx) => {
    if (typeof ctx.value !== 'number') {
        throw new Error('Value is not a number');
    }
    return ctx.value;
};

describe('Container.runSync', () => {
    it('should validate synchronously when every mount is sync', () => {
        const container = new Container<{ name: string, age: number }>();
        container.mount('name', isString);
        container.mount('age', isNumber);

        const out = container.runSync({ name: 'Peter', age: 30 });

        expect(out.name).toEqual('Peter');
        expect(out.age).toEqual(30);
    });

    it('should throw when a validator returns a Promise', () => {
        const container = new Container<{ name: string }>();
        container.mount('name', async (ctx) => ctx.value);

        expect(() => container.runSync({ name: 'Peter' })).toThrow(/returned a Promise/);
    });

    it('should aggregate sync validator failures into a ValidupError', () => {
        const container = new Container<{ name: string, age: number }>();
        container.mount('name', isString);
        container.mount('age', isNumber);

        try {
            container.runSync({ name: 42, age: 'thirty' });
            expect.fail('expected runSync to throw');
        } catch (e) {
            expect(e).toBeInstanceOf(ValidupError);
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(2);
            }
        }
    });

    it('should descend into nested containers that implement runSync', () => {
        const inner = new Container<{ city: string }>();
        inner.mount('city', isString);

        const outer = new Container<{ address: { city: string } }>();
        outer.mount('address', inner);

        const out = outer.runSync({ address: { city: 'Berlin' } });
        expect(out.address?.city).toEqual('Berlin');
    });

    it('should throw when a nested container does not implement runSync', () => {
        const child: any = {
            run: async (input: any) => input,
            safeRun: async () => ({ success: true, data: {} }),
        };

        const parent = new Container<{ nested: Record<string, unknown> }>();
        parent.mount('nested', child);

        expect(() => parent.runSync({ nested: { a: 1 } })).toThrow(/does not implement runSync/);
    });

    it('should respect group filtering', () => {
        const container = new Container<{ name: string, code: string }>();
        container.mount('name', { group: 'create' }, isString);
        container.mount('code', { group: 'update' }, isString);

        const out = container.runSync({ name: 'Peter', code: 42 } as any, { group: 'create' });
        expect(out.name).toEqual('Peter');
        expect(out.code).toBeUndefined();
    });

    it('should fill defaults', () => {
        const container = new Container<{ role: string }>();
        const out = container.runSync({}, { defaults: { role: 'user' } });
        expect(out.role).toEqual('user');
    });

    it('should expose runSync on safeRunSync as a Result wrapper', () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const ok = container.safeRunSync({ name: 'Peter' });
        expect(ok.success).toBe(true);
        if (ok.success) {
            expect(ok.data.name).toEqual('Peter');
        }

        const fail = container.safeRunSync({ name: 42 } as any);
        expect(fail.success).toBe(false);
    });
});
