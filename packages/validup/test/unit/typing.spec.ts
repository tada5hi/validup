/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { Container } from '../../src';
import type { Validator } from '../../src';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value must be a string');
    }
    return ctx.value;
};

// Compile-time regression for issue #392: `Container<T>.run` (and siblings)
// must accept `Partial<T>` so a form narrower than the validator entity
// type-checks without an `as any` cast.

type User = {
    id: number,
    name: string,
    email: string,
    createdAt: Date,
};

describe('typing: run/safeRun accept Partial<T> (issue #392)', () => {
    it('run() accepts an input narrower than T', async () => {
        const container = new Container<User>();
        container.mount('name', isString);
        container.mount('email', isString);

        // Pre-fix this required `form as any`; `Partial<User>` is what the
        // runtime already tolerates and the type now reflects that.
        const form: Partial<User> = { name: 'peter', email: 'peter@example.com' };
        const out = await container.run(form);
        expect(out.name).toBe('peter');
        expect(out.email).toBe('peter@example.com');
    });

    it('safeRun() accepts an input narrower than T', async () => {
        const container = new Container<User>();
        container.mount('name', isString);

        const form: Partial<User> = { name: 'peter' };
        const result = await container.safeRun(form);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('peter');
        }
    });

    it('runSync() / safeRunSync() accept Partial<T>', () => {
        const container = new Container<User>();
        container.mount('name', isString);

        const form: Partial<User> = { name: 'peter' };
        const out = container.runSync(form);
        expect(out.name).toBe('peter');

        const result = container.safeRunSync(form);
        expect(result.success).toBe(true);
    });

    it('defaults is partial — supplying only some keys is enough', async () => {
        const container = new Container<User>();
        // No mounts; we only want to exercise the defaults-fill path.
        const out = await container.run({}, { defaults: { name: 'fallback' } });
        // Pre-fix this required defaults to enumerate every Path<User> key.
        expect(out).toEqual({ name: 'fallback' });
    });
});
