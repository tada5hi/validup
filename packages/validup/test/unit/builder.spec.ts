/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    assertType,
    describe,
    expect,
    expectTypeOf,
    it,
} from 'vitest';
import {
    Container,
    type Validator,
    ValidupError,
    defineSchema,
} from '../../src';

const stringValidator: Validator<unknown, string> = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }
    return ctx.value;
};

const numberValidator: Validator<unknown, number> = (ctx) => {
    if (typeof ctx.value !== 'number') {
        throw new Error('Value is not a number');
    }
    return ctx.value;
};

describe('src/builder', () => {
    it('builds a Container that runs accumulated mounts', async () => {
        const schema = defineSchema()
            .field('foo', stringValidator)
            .field('bar', numberValidator)
            .build();

        expect(schema).toBeInstanceOf(Container);

        const out = await schema.run({ foo: 'hello', bar: 42 });

        expect(out).toEqual({ foo: 'hello', bar: 42 });
        expectTypeOf(out).toEqualTypeOf<{ foo: string, bar: number }>();
    });

    it('treats every method call as immutable', () => {
        const a = defineSchema().field('foo', stringValidator);
        const b = a.field('bar', numberValidator);

        const aBuilt = a.build();
        const bBuilt = b.build();

        // The two builds should hold a different number of mounts — i.e. `a`
        // wasn't mutated when `b` was derived.
        expect((aBuilt as any).items.length).toEqual(1);
        expect((bBuilt as any).items.length).toEqual(2);
    });

    it('reflects the accumulated shape on optional() with `?` widening', async () => {
        const schema = defineSchema()
            .field('foo', stringValidator)
            .optional('bar', numberValidator)
            .build();

        const present = await schema.run({ foo: 'x', bar: 1 });
        expectTypeOf(present).toEqualTypeOf<{ foo: string, bar?: number }>();
        expect(present).toEqual({ foo: 'x', bar: 1 });

        const missing = await schema.run({ foo: 'x' });
        // optional bar drops out of the object when missing
        expect(missing).toEqual({ foo: 'x' });
    });

    it('forwards optionalValue / optionalInclude through optional()', async () => {
        const schema = defineSchema()
            .optional('bar', numberValidator, {
                optionalValue: 'null',
                optionalInclude: true,
            })
            .build();

        const out = await schema.run({ bar: null });
        expect(out).toEqual({ bar: null });
    });

    it('nests a child builder and merges the shape', async () => {
        const parent = defineSchema()
            .field('id', stringValidator)
            .nest('child', defineSchema()
                .field('age', numberValidator))
            .build();

        const out = await parent.run({ id: 'p', child: { age: 30 } });

        expect(out).toEqual({ id: 'p', child: { age: 30 } });
        expectTypeOf(out).toEqualTypeOf<{
            id: string,
            child: { age: number },
        }>();
    });

    it('also accepts a Container as a nest() target', async () => {
        const child = new Container<{ age: number }>();
        child.mount('age', numberValidator);

        const parent = defineSchema()
            .field('id', stringValidator)
            .nest('child', child)
            .build();

        const out = await parent.run({ id: 'p', child: { age: 12 } });
        expect(out).toEqual({ id: 'p', child: { age: 12 } });
    });

    it('toggles oneOf and produces a single ONE_OF_FAILED group when every branch fails', async () => {
        const schema = defineSchema()
            .field('foo', stringValidator)
            .field('bar', numberValidator)
            .oneOf()
            .build();

        // both branches happy — passes (only one needs to)
        await expect(schema.run({ foo: 'a', bar: 1 })).resolves.toBeDefined();

        // both branches angry — fails as oneOf group
        try {
            await schema.run({ foo: 1, bar: 'no' });
            throw new Error('expected ValidupError');
        } catch (e) {
            expect(e).toBeInstanceOf(ValidupError);
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].type).toEqual('group');
                if (e.issues[0].type === 'group') {
                    expect(e.issues[0].code).toEqual('one_of_failed');
                    expect(e.issues[0].issues.length).toBeGreaterThanOrEqual(2);
                }
            }
        }

        // first happy — succeeds (oneOf passes if at least one succeeded)
        const out = await schema.run({ foo: 'a', bar: 'no' });
        expect(out.foo).toEqual('a');
    });

    it('forwards pathsToInclude/pathsToExclude to the underlying Container', async () => {
        const included = defineSchema()
            .field('foo', stringValidator)
            .field('bar', numberValidator)
            .pathsToInclude('foo')
            .build();

        // bar would normally throw because the value is not a number, but
        // pathsToInclude limits execution to `foo` only.
        const out = await included.run({ foo: 'a', bar: 'not-a-number' });
        expect(out.foo).toEqual('a');

        const excluded = defineSchema()
            .field('foo', stringValidator)
            .field('bar', numberValidator)
            .pathsToExclude('bar')
            .build();

        const out2 = await excluded.run({ foo: 'b', bar: 'not-a-number' });
        expect(out2.foo).toEqual('b');
    });

    it('infers Out from validators', () => {
        const schema = defineSchema()
            .field('s', stringValidator)
            .field('n', numberValidator)
            .build();

        // run() return type reflects the registered shape — type-only check.
        type RunResult = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<RunResult>().toEqualTypeOf<{ s: string, n: number }>();
    });

    it('threads context through validators and nest()', async () => {
        type AppCtx = { user: string };

        const validator: Validator<AppCtx, string> = (ctx) => {
            assertType<AppCtx>(ctx.context);
            return ctx.context.user;
        };

        const schema = defineSchema<AppCtx>()
            .field('whoami', validator)
            .nest('inner', defineSchema<AppCtx>()
                .field('whoami', validator))
            .build();

        const out = await schema.run({}, { context: { user: 'peter' } });
        expect(out).toEqual({
            whoami: 'peter',
            inner: { whoami: 'peter' },
        });
    });

    it('produces a ValidupError when a registered field rejects', async () => {
        const schema = defineSchema()
            .field('foo', stringValidator)
            .build();

        expect.assertions(2);
        try {
            await schema.run({ foo: 1 });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].path).toEqual(['foo']);
            }
        }
    });

    it('ignores keys that were not registered (no compile-time enforcement at runtime)', async () => {
        const schema = defineSchema()
            .field('foo', stringValidator)
            .build();

        // `bar` was never registered — runtime simply doesn't visit it.
        const out = await schema.run({ foo: 'x', bar: 'unused' } as any);
        expect(out).toEqual({ foo: 'x' });
    });
});
