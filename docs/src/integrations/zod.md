# @validup/zod

A [zod](https://zod.dev) integration that surfaces zod's vendor-specific issue fields (`expected`, `received`) and ships a reverse `validup → zod` converter for downstream pipelines.

```bash
npm install @validup/zod validup zod --save
```

| Peer dependency | Supported versions  |
|-----------------|---------------------|
| `zod`           | `^3.25.0 \|\| ^4.0.0` |

> **Already on zod 3.24+ and don't need vendor-specific fields?** Use [`@validup/standard-schema`](/integrations/standard-schema) — it works against zod, valibot, and arktype interchangeably.

## Quick start

```typescript
import { Container, isValidupError } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

const user = new Container<{ email: string; age: number }>();
user.mount('email', createValidator(z.string().email()));
user.mount('age',   createValidator(z.number().int().positive()));

try {
    const valid = await user.run({ email: 'peter@example.com', age: 28 });
} catch (e) {
    if (isValidupError(e)) console.log(e.issues);
}
```

`createValidator` returns a validup `Validator`. Mount it with any other mount option:

```typescript
container.mount('field', { group: 'create' }, createValidator(z.string()));
container.mount('opt',   { optional: true },  createValidator(z.number()));
```

## Per-context schemas

Pass a function instead of a schema to build the schema lazily from `ValidatorContext`:

```typescript
const password = createValidator((ctx) => {
    if (ctx.group === 'create') return z.string().min(12);
    return z.string().min(12).optional();
});

container.mount('password', { group: 'create' }, password);
container.mount('password', { group: 'update' }, password);
```

```typescript
type ZodCreateFn<C = unknown> = (ctx: ValidatorContext<C>) => ZodType;
```

`createValidator<C>(...)` is generic over the validup context, so factories can read typed `ctx.context` when the parent declares one (`Container<T, C>`).

## Zod → Validup

When a schema fails to parse, the adapter calls `safeParseAsync`, then converts each `ZodIssue` into a validup `IssueItem` (preserving `expected` / `received` fields), and throws a `ValidupError` carrying those issues.

```typescript
container.mount('user', createValidator(z.object({
    name: z.string(),
    age: z.number().min(18),
})));

try {
    await container.run({ user: { name: 42, age: 10 } });
} catch (e) {
    if (isValidupError(e)) {
        // e.issues:
        // [{ type: 'group', path: ['user'], issues: [
        //     { type: 'item', path: ['user','name'], expected: 'string', received: 'number', ... },
        //     { type: 'item', path: ['user','age'],  message: 'Number must be ≥ 18', ... },
        //   ]}]
    }
}
```

## Validup → Zod

Convert a `ValidupError` (or single `Issue`) into zod's raw issue format — useful when feeding validup output back into a zod-driven UI library:

```typescript
import { buildZodIssuesForError, buildZodIssuesForIssue } from '@validup/zod';

try {
    await container.run(input);
} catch (e) {
    if (isValidupError(e)) {
        const zodIssues = buildZodIssuesForError(e);
        // [{ code: 'custom', message: '...', path: [...], input: ... }, ...]
    }
}
```

## API

| Export                       | Description                                                                  |
|------------------------------|------------------------------------------------------------------------------|
| `createValidator(schema)`    | Wrap a `ZodType` (or `(ctx) => ZodType`) as a validup `Validator`.           |
| `buildIssuesForZodError(e)`  | Convert a `ZodError` into an array of validup `Issue`s.                      |
| `buildZodIssuesForError(e)`  | Convert a `ValidupError` into an array of zod raw issues.                    |
| `buildZodIssuesForIssue(i)`  | Convert a single validup `Issue` into zod raw issues (recurses into groups). |
| `ZodIssue`                   | Re-exported alias for `$ZodRawIssue` from `zod/v4/core`.                     |
