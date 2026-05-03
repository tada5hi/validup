/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import type { Validator } from '../../src';
import { Container } from '../../src';

describe('container context propagation', () => {
    type AppContext = { userId: string };

    it('should expose run-time context on ValidatorContext', async () => {
        const seen: unknown[] = [];

        const container = new Container<{ foo: string }, AppContext>();
        const validator: Validator<AppContext> = (ctx) => {
            seen.push(ctx.context);
            return ctx.value;
        };
        container.mount('foo', validator);

        await container.run({ foo: 'bar' }, { context: { userId: 'u-1' } });

        expect(seen).toEqual([{ userId: 'u-1' }]);
    });

    it('should default ctx.context to undefined when no context is passed', async () => {
        const seen: unknown[] = [];

        const container = new Container<{ foo: string }>();
        const validator: Validator = (ctx) => {
            seen.push(ctx.context);
            return ctx.value;
        };
        container.mount('foo', validator);

        await container.run({ foo: 'bar' });

        expect(seen).toEqual([undefined]);
    });

    it('should forward context unchanged into nested containers', async () => {
        const seen: unknown[] = [];

        const child = new Container<{ inner: string }, AppContext>();
        const childValidator: Validator<AppContext> = (ctx) => {
            seen.push(ctx.context);
            return ctx.value;
        };
        child.mount('inner', childValidator);

        const parent = new Container<{ nested: { inner: string } }, AppContext>();
        parent.mount('nested', child);

        const ctx: AppContext = { userId: 'u-2' };
        await parent.run(
            { nested: { inner: 'value' } },
            { context: ctx },
        );

        expect(seen).toEqual([ctx]);
    });

    it('should pass context into safeRun', async () => {
        const seen: unknown[] = [];

        const container = new Container<{ foo: string }, AppContext>();
        const validator: Validator<AppContext> = (ctx) => {
            seen.push(ctx.context);
            return ctx.value;
        };
        container.mount('foo', validator);

        const result = await container.safeRun(
            { foo: 'bar' },
            { context: { userId: 'u-3' } },
        );

        expect(result.success).toBe(true);
        expect(seen).toEqual([{ userId: 'u-3' }]);
    });
});
