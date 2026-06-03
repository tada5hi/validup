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

`createValidator` returns a validup `ValidatorDescriptor` — interchangeable with a bare `Validator` at the mount site. Mount it with any other mount option:

```typescript
container.mount('field', { group: 'create' }, createValidator(z.string()));
container.mount('opt',   { optional: true },  createValidator(z.number()));
```

## Result caching (`sideEffect`)

The descriptor returned by `createValidator` participates in validup's [result cache](/guide/caching) by default. Most zod schemas (`z.string().email()`, length / regex / enum checks) are deterministic, so the framework can replay a cached `(ctx.value, ctx.context, ctx.group)` snapshot without re-running the schema:

```typescript
import { ResultCache } from 'validup';

const cache = new ResultCache();
await container.run(data, { cache });
await container.run(data, { cache }); // schema not re-invoked
```

For schemas with async refines or `superRefine` calls reading external state, opt out per call site:

```typescript
container.mount('email', createValidator(
    z.string().refine(async (v) => !(await isEmailTaken(v))),
    { sideEffect: true },
));
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

### Code mapping

Each zod issue's `code` is mapped onto validup's [`IssueCode`](/guide/issues) vocabulary so consumer-side i18n catalogs (e.g. [`@ilingo/validup`](https://npmjs.com/package/@ilingo/validup)) can ship one parameterized message per code instead of falling back to a generic "invalid value" string:

| Zod issue                                                          | Validup `IssueCode`                | `data`                |
|--------------------------------------------------------------------|------------------------------------|-----------------------|
| `invalid_type` (input at path is `undefined`)                      | `REQUIRED`                         | —                     |
| `invalid_type` (wrong type)                                        | `VALUE_INVALID`                    | —                     |
| `too_small`, origin `string` / `array` / `set` / `file`            | `MIN_LENGTH`                       | `{ min: number }`     |
| `too_big`, origin `string` / `array` / `set` / `file`              | `MAX_LENGTH`                       | `{ max: number }`     |
| `too_small`, origin `number` / `bigint` / `date` / `int`           | `MIN_VALUE`                        | `{ min: number }`     |
| `too_big`, origin `number` / `bigint` / `date` / `int`             | `MAX_VALUE`                        | `{ max: number }`     |
| `invalid_format`, format `email`                                   | `EMAIL`                            | —                     |
| `invalid_format`, format `url`                                     | `URL`                              | —                     |
| `invalid_format`, format `uuid` / `guid`                           | `UUID`                             | —                     |
| `invalid_format`, format `regex`                                   | `PATTERN`                          | `{ pattern: string }` |
| `invalid_format`, format `date` / `time` / `datetime` / `duration` | `DATE`                             | —                     |
| `invalid_format`, format `ipv4` / `ipv6` / `cidrv4` / `cidrv6`     | `IP_ADDRESS`                       | —                     |
| `invalid_format`, format `base64` / `base64url`                    | `BASE64`                           | —                     |
| `invalid_format`, format `json_string`                             | `JSON`                             | —                     |
| `invalid_value` (enum / literal mismatch)                          | `ONE_OF_FAILED`                    | —                     |
| Everything else (`custom`, `not_multiple_of`, `unrecognized_keys`, `invalid_union`, …) | `VALUE_INVALID` | —              |

::: tip REQUIRED detection requires the input
Zod 4 strips `received` / `input` from the formatted `ZodError`, so the adapter recovers the missing-key signal by looking the issue path up against the original parsed value. `createValidator` threads `ctx.value` through automatically; if you call `buildIssuesForZodError(error)` directly without a second argument, missing keys stay on `VALUE_INVALID`. Pass the input explicitly (`buildIssuesForZodError(error, input)`) to opt in.
:::

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
| `createValidator(schema, options?)` | Wrap a `ZodType` (or `(ctx) => ZodType`) as a validup `ValidatorDescriptor`. `options.sideEffect: true` bypasses the result cache. |
| `buildIssuesForZodError(e, input?)` | Convert a `ZodError` into an array of validup `Issue`s. Pass the parsed input as the second argument to enable `invalid_type` → `REQUIRED` promotion for missing keys. |
| `buildZodIssuesForError(e)`  | Convert a `ValidupError` into an array of zod raw issues.                    |
| `buildZodIssuesForIssue(i)`  | Convert a single validup `Issue` into zod raw issues (recurses into groups). |
| `ZodIssue`                   | Re-exported alias for `$ZodRawIssue` from `zod/v4/core`.                     |
