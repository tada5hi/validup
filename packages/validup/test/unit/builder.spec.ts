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
            .mount('foo', stringValidator)
            .mount('bar', numberValidator)
            .build();

        expect(schema).toBeInstanceOf(Container);

        const out = await schema.run({ foo: 'hello', bar: 42 });

        expect(out).toEqual({ foo: 'hello', bar: 42 });
        expectTypeOf(out).toEqualTypeOf<{ foo: string, bar: number }>();
    });

    it('treats every method call as immutable', () => {
        const a = defineSchema().mount('foo', stringValidator);
        const b = a.mount('bar', numberValidator);

        const aBuilt = a.build();
        const bBuilt = b.build();

        // The two builds should hold a different number of mounts — i.e. `a`
        // wasn't mutated when `b` was derived.
        expect((aBuilt as any).items.length).toEqual(1);
        expect((bBuilt as any).items.length).toEqual(2);
    });

    it('widens the accumulated shape when options.optional is true', async () => {
        const schema = defineSchema()
            .mount('foo', stringValidator)
            .mount('bar', { optional: true }, numberValidator)
            .build();

        const present = await schema.run({ foo: 'x', bar: 1 });
        expectTypeOf(present).toEqualTypeOf<{ foo: string, bar?: number }>();
        expect(present).toEqual({ foo: 'x', bar: 1 });

        const missing = await schema.run({ foo: 'x' });
        // optional bar drops out of the object when missing
        expect(missing).toEqual({ foo: 'x' });
    });

    it('forwards optionalValue / optionalInclude alongside optional', async () => {
        const schema = defineSchema()
            .mount('bar', {
                optional: true,
                optionalValue: 'null',
                optionalInclude: true,
            }, numberValidator)
            .build();

        const out = await schema.run({ bar: null });
        expect(out).toEqual({ bar: null });
    });

    it('widens to optional when options.optional is a predicate function', async () => {
        const schema = defineSchema()
            .mount('bar', { optional: (v) => v === '' || typeof v === 'undefined' }, stringValidator)
            .build();

        const out = await schema.run({});
        expect(out).toEqual({});
        // Type-only: predicate optional should still surface as `bar?`
        type R = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<R>().toEqualTypeOf<{ bar?: string }>();
    });

    it('keeps the accumulated key required when options.optional is omitted', async () => {
        const schema = defineSchema()
            .mount('bar', { group: 'create' }, stringValidator)
            .build();

        type R = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<R>().toEqualTypeOf<{ bar: string }>();

        const out = await schema.run({ bar: 'x' }, { group: 'create' });
        expect(out).toEqual({ bar: 'x' });
    });

    it('nests a child builder and merges the shape', async () => {
        const parent = defineSchema()
            .mount('id', stringValidator)
            .mount('child', defineSchema()
                .mount('age', numberValidator))
            .build();

        const out = await parent.run({ id: 'p', child: { age: 30 } });

        expect(out).toEqual({ id: 'p', child: { age: 30 } });
        expectTypeOf(out).toEqualTypeOf<{
            id: string,
            child: { age: number },
        }>();
    });

    it('also accepts a Container as a mount target', async () => {
        const child = new Container<{ age: number }>();
        child.mount('age', numberValidator);

        const parent = defineSchema()
            .mount('id', stringValidator)
            .mount('child', child)
            .build();

        const out = await parent.run({ id: 'p', child: { age: 12 } });
        expect(out).toEqual({ id: 'p', child: { age: 12 } });
    });

    it('toggles oneOf and produces a single ONE_OF_FAILED group when every branch fails', async () => {
        const schema = defineSchema()
            .mount('foo', stringValidator)
            .mount('bar', numberValidator)
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
            .mount('foo', stringValidator)
            .mount('bar', numberValidator)
            .pathsToInclude('foo')
            .build();

        // bar would normally throw because the value is not a number, but
        // pathsToInclude limits execution to `foo` only.
        const out = await included.run({ foo: 'a', bar: 'not-a-number' });
        expect(out.foo).toEqual('a');

        const excluded = defineSchema()
            .mount('foo', stringValidator)
            .mount('bar', numberValidator)
            .pathsToExclude('bar')
            .build();

        const out2 = await excluded.run({ foo: 'b', bar: 'not-a-number' });
        expect(out2.foo).toEqual('b');
    });

    it('infers Out from validators', () => {
        const schema = defineSchema()
            .mount('s', stringValidator)
            .mount('n', numberValidator)
            .build();

        // run() return type reflects the registered shape — type-only check.
        type RunResult = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<RunResult>().toEqualTypeOf<{ s: string, n: number }>();
    });

    it('threads context through validators and nested builders', async () => {
        type AppCtx = { user: string };

        const validator: Validator<AppCtx, string> = (ctx) => {
            assertType<AppCtx>(ctx.context);
            return ctx.context.user;
        };

        const schema = defineSchema<AppCtx>()
            .mount('whoami', validator)
            .mount('inner', defineSchema<AppCtx>()
                .mount('whoami', validator))
            .build();

        const out = await schema.run({}, { context: { user: 'peter' } });
        expect(out).toEqual({
            whoami: 'peter',
            inner: { whoami: 'peter' },
        });
    });

    it('produces a ValidupError when a registered field rejects', async () => {
        const schema = defineSchema()
            .mount('foo', stringValidator)
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

    it('widens optional nested builder to optional in T', () => {
        const child = defineSchema()
            .mount('city', stringValidator);

        const schema = defineSchema()
            .mount('address', { optional: true }, child)
            .build();

        type R = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<R>().toEqualTypeOf<{ address?: { city: string } }>();
    });

    it('widens optional nested Container to optional in T', () => {
        const child = new Container<{ city: string }>();
        child.mount('city', stringValidator);

        const schema = defineSchema()
            .mount('address', { optional: true }, child)
            .build();

        type R = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<R>().toEqualTypeOf<{ address?: { city: string } }>();
    });

    it('overrides previous mount type when remounting the same key (last write wins)', async () => {
        // sanitize-then-validate: both mounts succeed; the second's Out becomes T[K]
        const passthrough: Validator<unknown, string> = (ctx) => String(ctx.value);
        const toNumber: Validator<unknown, number> = (ctx) => Number(ctx.value);

        const schema = defineSchema()
            .mount('foo', passthrough)  // would type foo as string
            .mount('foo', toNumber)     // overrides — final type is number
            .build();

        type R = Awaited<ReturnType<typeof schema.run>>;
        expectTypeOf<R>().toEqualTypeOf<{ foo: number }>();

        // Runtime: second mount reads output[foo] from the first, writes last.
        const out = await schema.run({ foo: '42' });
        expect(out).toEqual({ foo: 42 });
    });

    it('ignores keys that were not registered (no compile-time enforcement at runtime)', async () => {
        const schema = defineSchema()
            .mount('foo', stringValidator)
            .build();

        // `bar` was never registered — runtime simply doesn't visit it.
        const out = await schema.run({ foo: 'x', bar: 'unused' } as any);
        expect(out).toEqual({ foo: 'x' });
    });
});
