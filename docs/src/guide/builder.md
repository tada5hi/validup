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
    .field('foo', createValidator(z.string()))   // accumulated: { foo: string }
    .field('age', createValidator(z.number()))   // accumulated: { foo: string; age: number }
    .build();

const out = await schema.run(input);
// out: { foo: string; age: number } — inferred, not declared
```

`schema` is a regular `Container<{ foo: string; age: number }, unknown>`. `.build()` materializes the container; everything `Container` exposes (`run`, `safeRun`, `runSync`, `runParallel`, `safeRunSync`) is available.

## Methods

```typescript
interface Builder<T extends Record<string, any>, C = unknown> {
    field<K extends string, Out>(
        key: K,
        validator: Validator<C, Out>,
        options?: MountOptions,
    ): Builder<T & { [P in K]: Awaited<Out> }, C>;

    optional<K extends string, Out>(
        key: K,
        validator: Validator<C, Out>,
        options?: Omit<MountOptions, 'optional'>,
    ): Builder<T & { [P in K]?: Awaited<Out> }, C>;

    nest<K extends string, U>(
        key: K,
        child: Builder<U, C> | IContainer<U, C>,
        options?: MountOptions,
    ): Builder<T & { [P in K]: U }, C>;

    oneOf(): Builder<T, C>;
    pathsToInclude(...paths: (keyof T & string)[]): Builder<T, C>;
    pathsToExclude(...paths: (keyof T & string)[]): Builder<T, C>;

    build(): Container<T, C>;
}
```

| Method                                                | Effect on `T`                                  | Notes                                                                                       |
|-------------------------------------------------------|------------------------------------------------|---------------------------------------------------------------------------------------------|
| `.field(key, validator, options?)`                    | adds `{ [K]: Awaited<Out> }`                   | Required field. `Out` is inferred from the validator's return type.                         |
| `.optional(key, validator, options?)`                 | adds `{ [K]?: Awaited<Out> }`                  | Sets `optional: true`. `optionalValue` / `optionalInclude` can still be passed via options. |
| `.nest(key, builder \| container, options?)`          | adds `{ [K]: U }`                              | If a `Builder` is given, it is `.build()`-ed automatically.                                 |
| `.oneOf()`                                            | unchanged                                      | Container-level `oneOf` flag. See [One-Of](/guide/one-of).                                  |
| `.pathsToInclude(...keys)` / `.pathsToExclude(...keys)` | unchanged                                    | Restrict execution to / from specific top-level keys.                                       |
| `.build()`                                            | —                                              | Returns a `Container<T, C>`.                                                                |

Builders are **immutable** — every method returns a new builder, so chains may fork without leaking state.

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
    .field('slug', slug)   // accumulated: { slug: string }
    .build();
```

…or write the function inline so TypeScript infers from the body:

```typescript
const schema = defineSchema()
    .field('count', (ctx) => {
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
    .field('slug', async (ctx) => {
        // ctx.context is typed as AppContext
        await assertSlugAvailable(ctx.value, ctx.context.userId);
        return ctx.value;
    })
    .nest('inner', defineSchema<AppContext>()
        .field('whoami', (ctx) => ctx.context.userId))
    .build();

await schema.run(input, { context: { userId: 'u-42' } });
```

## Nesting

`nest(key, child, options?)` accepts either a `Builder` (auto-`.build()`-ed) or an existing `Container`. The child's accumulated shape becomes `T[K]`:

```typescript
const address = defineSchema()
    .field('city', isString)
    .field('country', isString);

const user = defineSchema()
    .field('name', isString)
    .nest('address', address)        // address auto-builds
    .build();

// user is Container<{ name: string; address: { city: string; country: string } }>
```

For framework integrations (e.g. mounting a routup adapter) pass the underlying `Container` instance directly.

## When to use which API

| Goal                                                                  | API                              |
|-----------------------------------------------------------------------|----------------------------------|
| Static schema, want compile-time exhaustiveness                       | `defineSchema()` builder         |
| Dynamic mounts (loops, conditional registration, `initialize()` hook) | `new Container<T>()`             |
| Ship a domain-scoped, reusable validator class                        | `class extends Container<T>`     |

The imperative `Container` API is **not** deprecated — it remains the runtime substrate (`.build()` calls `Container.mount(...)`) and the right tool whenever the schema isn't fully known up front.

## Caveats

- **`oneOf()` and `T`.** A `oneOf` container's `T` stays as the **intersection** of branches, but only one branch's keys actually appear at runtime. The intersection is honest about *possible* keys; wrap with your own discriminated union when that fits better.
- **Cross-field refinements** don't fit the per-field model. Continue to mount them either as a top-level validator on a non-content key (`.field('_invariants', crossFieldValidator)`) or as a `oneOf` branch.
- **Group exhaustiveness.** The builder guarantees every key in `T` was registered at *build time*. It does not guarantee that, e.g., `group: 'create'` covers every required field for that group — the runtime still skips group-mismatched mounts.
