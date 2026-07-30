# @validup/standard-schema

A vendor-neutral validator adapter built on the [Standard Schema](https://standardschema.dev) protocol. Wrap **any** Standard-Schema-conformant library — zod 3.24+, valibot, arktype, effect-schema — as a validup `Validator`.

```bash
npm install @validup/standard-schema validup --save
```

## Quick start

```typescript
import { Container } from 'validup';
import { createStandardSchemaValidator } from '@validup/standard-schema';
import { z } from 'zod';        // any Standard Schema library works

const user = new Container<{ email: string; age: number }>();
user.mount('email', createStandardSchemaValidator(z.string().email()));
user.mount('age',   createStandardSchemaValidator(z.number().int().positive()));

const data = await user.run({ email: 'peter@example.com', age: 28 });
```

The adapter calls `schema['~standard'].validate(ctx.value)` and returns a validup `ValidatorDescriptor` (interchangeable with a bare `Validator` at the mount site). On failure each `StandardSchemaV1.Issue` becomes a validup `IssueItem`, with the path normalized so `{ key }`-shape `PathSegment` entries flatten into a `PropertyKey[]`.

## Result caching (`sideEffect`)

`createStandardSchemaValidator` returns a cache-eligible descriptor by default — the [validup result cache](/guide/caching) will replay results when `(ctx.value, ctx.context, ctx.group)` is unchanged. Pass `{ sideEffect: true }` to bypass the cache for schemas that read external state:

```typescript
container.mount('email', createStandardSchemaValidator(asyncSchema, { sideEffect: true }));
```

## Per-context schemas

```typescript
import { createStandardSchemaValidator } from '@validup/standard-schema';

const password = createStandardSchemaValidator((ctx) => {
    if (ctx.group === 'create') return z.string().min(12);
    return z.string().min(12).optional();
});

container.mount('password', { group: 'create' }, password);
container.mount('password', { group: 'update' }, password);
```

## Trade-offs vs `@validup/zod`

| Concern                                          | `@validup/standard-schema` | `@validup/zod` |
|--------------------------------------------------|----------------------------|----------------|
| Works with any Standard-Schema library           | ✅                         | ❌ (zod only)  |
| `expected` / `received` on issues                | ❌                         | ✅             |
| `buildZodIssuesForError` (validup → zod)         | ❌                         | ✅             |
| Vendor-neutral switching                         | ✅                         | ❌             |

Pick `@validup/standard-schema` when you want **library portability** or are happy with the portable subset of issue fields. Pick `@validup/zod` for full zod fidelity.

## API

| Export                       | Description                                                                  |
|------------------------------|------------------------------------------------------------------------------|
| `createStandardSchemaValidator(schema, options?)` | Wrap a Standard Schema (or `(ctx) => schema`) as a validup `ValidatorDescriptor`. `options.sideEffect: true` bypasses the result cache. |
| `buildIssuesForStandardSchemaIssues(issues)` | Convert `StandardSchemaV1.Issue[]` into validup `Issue[]`.   |
