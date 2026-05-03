# @validup/standard-schema

A vendor-neutral validator adapter built on the [Standard Schema](https://standardschema.dev) protocol. Wrap **any** Standard-Schema-conformant library — zod 3.24+, valibot, arktype, effect-schema — as a validup `Validator`.

```bash
npm install @validup/standard-schema validup --save
```

## Quick start

```typescript
import { Container } from 'validup';
import { createValidator } from '@validup/standard-schema';
import { z } from 'zod';        // any Standard Schema library works

const user = new Container<{ email: string; age: number }>();
user.mount('email', createValidator(z.string().email()));
user.mount('age',   createValidator(z.number().int().positive()));

const data = await user.run({ email: 'peter@example.com', age: 28 });
```

The adapter calls `schema['~standard'].validate(ctx.value)`. On failure each `StandardSchemaV1.Issue` becomes a validup `IssueItem`, with the path normalized so `{ key }`-shape `PathSegment` entries flatten into a `PropertyKey[]`.

## Per-context schemas

```typescript
import { createValidator } from '@validup/standard-schema';

const password = createValidator((ctx) => {
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
| `createValidator(schema)`    | Wrap a Standard Schema (or `(ctx) => schema`) as a validup `Validator`.      |
| `buildIssuesForStandardSchemaIssues(issues)` | Convert `StandardSchemaV1.Issue[]` into validup `Issue[]`.   |
