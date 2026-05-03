/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import { Container } from '../../src';

describe('container abort-signal propagation', () => {
    it('should expose ctx.signal to validators', async () => {
        const seen: (AbortSignal | undefined)[] = [];

        const container = new Container<{ foo: string }>();
        const validator: Validator = (ctx) => {
            seen.push(ctx.signal);
            return ctx.value;
        };
        container.mount('foo', validator);

        const controller = new AbortController();
        await container.run({ foo: 'bar' }, { signal: controller.signal });

        expect(seen).toHaveLength(1);
        expect(seen[0]).toBe(controller.signal);
    });

    it('should not break runs when no signal is supplied', async () => {
        const seen: (AbortSignal | undefined)[] = [];

        const container = new Container<{ foo: string }>();
        const validator: Validator = (ctx) => {
            seen.push(ctx.signal);
            return ctx.value;
        };
        container.mount('foo', validator);

        await container.run({ foo: 'bar' });

        expect(seen).toEqual([undefined]);
    });

    it('should short-circuit between mounts when aborted', async () => {
        const calls: string[] = [];
        const controller = new AbortController();

        const container = new Container<{ foo: string, bar: string }>();
        container.mount('foo', (ctx) => {
            calls.push('foo');
            controller.abort();
            return ctx.value;
        });
        container.mount('bar', (ctx) => {
            calls.push('bar');
            return ctx.value;
        });

        expect.assertions(2);
        try {
            await container.run({ foo: 'a', bar: 'b' }, { signal: controller.signal });
        } catch (e) {
            expect((e as Error).name).toEqual('AbortError');
        }

        expect(calls).toEqual(['foo']);
    });

    it('should rethrow validator-side aborts instead of wrapping them as issues', async () => {
        const controller = new AbortController();

        const container = new Container<{ foo: string }>();
        container.mount('foo', async (ctx) => {
            controller.abort(new Error('cancelled'));
            ctx.signal?.throwIfAborted();
            return ctx.value;
        });

        expect.assertions(1);
        try {
            await container.run({ foo: 'a' }, { signal: controller.signal });
        } catch (e) {
            expect((e as Error).message).toEqual('cancelled');
        }
    });

    it('should forward signal into nested containers', async () => {
        const childSeen: (AbortSignal | undefined)[] = [];

        const child = new Container<{ inner: string }>();
        child.mount('inner', (ctx) => {
            childSeen.push(ctx.signal);
            return ctx.value;
        });

        const parent = new Container<{ nested: { inner: string } }>();
        parent.mount('nested', child);

        const controller = new AbortController();
        await parent.run(
            { nested: { inner: 'x' } },
            { signal: controller.signal },
        );

        expect(childSeen).toHaveLength(1);
        expect(childSeen[0]).toBe(controller.signal);
    });

    it('should rethrow abort from safeRun instead of returning a failure result', async () => {
        const controller = new AbortController();

        const container = new Container<{ foo: string, bar: string }>();
        container.mount('foo', (ctx) => {
            controller.abort();
            return ctx.value;
        });
        container.mount('bar', (ctx) => ctx.value);

        expect.assertions(1);
        try {
            await container.safeRun({ foo: 'a', bar: 'b' }, { signal: controller.signal });
        } catch (e) {
            expect((e as Error).name).toEqual('AbortError');
        }
    });
});
