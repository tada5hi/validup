# Builder API

`new Container<T>()` happily accepts mounts that don't cover every required key of `T`, and `run()` returns `T` regardless. The TypeScript shape is a promise the runtime can't keep:

```typescript
const c = new Container<{ foo: string; bar: number }>();
c.mount('foo', isString);          // ⚠️  bar is never validated
const out = await c.run({});       // out: { foo, bar } — bar is undefined at runtime
```

`defineSchema()` is an opt-in, type-accumulating wrapper around `Container` that derives `T` *from the registered mounts* — so `run()`'s static return type reflects exactly what was registered.

## Quick Start

```typescript
import { defineSchema } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

const schema = defineSchema()
    .mount('foo', createValidator(z.string()))                            // { foo: string }
    .mount('age', { optional: true }, createValidator(z.number().int()))  // { foo: string; age?: number }
    .build();

const out = await schema.run(input);
// out: { foo: string; age?: number } — inferred, not declared
```

`schema` is a regular `Container<{ foo: string; age?: number }, unknown>`. `.build()` materializes the container; everything `Container` exposes (`run`, `safeRun`, `runSync`, `runParallel`, `safeRunSync`) is available.

## `mount(...)`

The builder mirrors `Container.mount`'s keyed forms — `(key, target)` and `(key, options, target)` — and dispatches on the target type:

| Target type                                 | Effect on `T`                                                                       |
|---------------------------------------------|-------------------------------------------------------------------------------------|
| `Validator<C, Out>`                         | adds `{ [K]: Awaited<Out> }`                                                        |
| `Validator<C, Out>` with `options.optional` | adds `{ [K]?: Awaited<Out> }`                                                       |
| `IBuilder<U, C>`                            | adds `{ [K]: U }` and auto-`.build()`s the child                                    |
| `IContainer<U, C>` (e.g. `Container<U, C>`) | adds `{ [K]: U }`                                                                   |

```typescript
defineSchema()
    .mount('id', isString)                                       // T & { id: string }
    .mount('email', { optional: true }, isString)                // T & { email?: string }
    .mount('address', defineSchema().mount('city', isString))    // T & { address: { city: string } }
    .build();
```

The same builder also exposes container-level switches that don't add fields:

```typescript
interface IBuilder<T extends Record<string, any>, C = unknown> {
    mount<K extends string, V extends Validator<C, any> | IBuilder<any, C> | IContainer<any, C>>(
        key: K,
        target: V,
    ): IBuilder<T & Mounted<K, V, undefined>, C>;

    mount<
        K extends string,
        const O extends MountOptions,
        V extends Validator<C, any> | IBuilder<any, C> | IContainer<any, C>,
    >(
        key: K,
        options: O,
        target: V,
    ): IBuilder<T & Mounted<K, V, O>, C>;

    oneOf(): IBuilder<T, C>;
    pathsToInclude(...paths: (keyof T & string)[]): IBuilder<T, C>;
    pathsToExclude(...paths: (keyof T & string)[]): IBuilder<T, C>;
    build(): Container<T, C>;
}
```

Builders are **immutable** — every method returns a new builder, so chains may fork without leaking state.

::: tip Optional widening
The `?`-widening only fires when TypeScript sees `optional` as the literal `true` (or a predicate function). The `const` modifier on the second overload preserves literal types from inline option objects, so `.mount('email', { optional: true }, isString)` just works. A pre-typed `MountOptions` variable whose `optional` is `boolean` keeps the field required.
:::

## Inferring `Out`

The integration packages' `createValidator(...)` functions infer the per-field `Out` from the underlying schema:

- `@validup/zod` — `Out = z.output<Schema>`
- `@validup/standard-schema` — `Out = StandardSchemaV1.InferOutput<Schema>`

Hand-written validators participate too. Either annotate the return type:

```typescript
const slug: Validator<unknown, string> = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('not a string');
    }
    return ctx.value.toLowerCase();
};

const schema = defineSchema()
    .mount('slug', slug)   // accumulated: { slug: string }
    .build();
```

…or write the function inline so TypeScript infers from the body:

```typescript
const schema = defineSchema()
    .mount('count', (ctx) => {
        const n = Number(ctx.value);
        if (!Number.isInteger(n)) throw new Error('not an int');
        return n;        // Out inferred as number
    })
    .build();
```

A bare `Validator<C>` (without the second generic) contributes `unknown` — which matches today's `Container<T>` behavior, so existing code keeps compiling.

## Context

Pass the context type as the generic parameter to flow it through nested builders and validator factories:

```typescript
type AppContext = { userId: string };

const schema = defineSchema<AppContext>()
    .mount('slug', async (ctx) => {
        // ctx.context is typed as AppContext
        await assertSlugAvailable(ctx.value, ctx.context.userId);
        return ctx.value;
    })
    .mount('inner', defineSchema<AppContext>()
        .mount('whoami', (ctx) => ctx.context.userId))
    .build();

await schema.run(input, { context: { userId: 'u-42' } });
```

## Nesting

Pass either a `Builder` (auto-`.build()`-ed) or an existing `Container` as the mount target. The child's accumulated shape becomes `T[K]`:

```typescript
const address = defineSchema()
    .mount('city', isString)
    .mount('country', isString);

const user = defineSchema()
    .mount('name', isString)
    .mount('address', address)        // address auto-builds
    .build();

// user is Container<{ name: string; address: { city: string; country: string } }>
```

For framework integrations (e.g. mounting a routup adapter) pass the underlying `Container` instance directly — same overload.

## When to use which API

| Goal                                                                  | API                              |
|-----------------------------------------------------------------------|----------------------------------|
| Static schema, want compile-time exhaustiveness                       | `defineSchema()` builder         |
| Dynamic mounts (loops, conditional registration, `initialize()` hook) | `new Container<T>()`             |
| Ship a domain-scoped, reusable validator class                        | `class extends Container<T>`     |

The imperative `Container` API is **not** deprecated — it remains the runtime substrate (`.build()` calls `Container.mount(...)`) and the right tool whenever the schema isn't fully known up front.

## Caveats

- **`oneOf()` and `T`.** A `oneOf` container's `T` stays as the **intersection** of branches, but only one branch's keys actually appear at runtime. The intersection is honest about *possible* keys; wrap with your own discriminated union when that fits better.
- **Cross-field refinements** don't fit the per-field model. Continue to mount them either as a top-level validator on a non-content key (`.mount('_invariants', crossFieldValidator)`) or as a `oneOf` branch.
- **Group exhaustiveness.** The builder guarantees every key in `T` was registered at *build time*. It does not guarantee that, e.g., `group: 'create'` covers every required field for that group — the runtime still skips group-mismatched mounts.
- **Same-key remount.** Calling `.mount('name', ...)` twice with different groups (a pattern from the README's `RoleValidator`) is not expressible in the builder — the second call overrides the first's `Out` via intersection. Use the imperative `Container` for that case.
