# @validup/standard-schema 🛡️

A [validup](https://www.npmjs.com/package/validup) integration for any [Standard Schema](https://standardschema.dev) validator — zod (3.24+), valibot, arktype, effect-schema, and any other library that implements the spec.

Mount any Standard Schema as a validup `Validator` on a `Container` path; validup handles path expansion, group filtering, optional/default semantics, and error aggregation while the underlying library does the actual parsing.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Per-Context Schemas](#per-context-schemas)
- [Error Mapping](#error-mapping)
- [Choosing Between `@validup/zod` and `@validup/standard-schema`](#choosing-between-validupzod-and-validupstandard-schema)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install @validup/standard-schema validup --save
```

The package depends only on the [`@standard-schema/spec`](https://www.npmjs.com/package/@standard-schema/spec) types and `validup` itself — bring your own schema library.

## Quick Start

```typescript
import { Container } from 'validup';
import { createValidator } from '@validup/standard-schema';
import { z } from 'zod';

const userValidator = new Container<{ email: string; age: number }>();

userValidator.mount('email', createValidator(z.string().email()));
userValidator.mount('age',   createValidator(z.number().int().positive()));

const user = await userValidator.run({ email: 'foo@example.com', age: 28 });
```

The same call works for any Standard-Schema-compatible library:

```typescript
import * as v from 'valibot';
import { type } from 'arktype';

userValidator.mount('email', createValidator(v.pipe(v.string(), v.email())));
userValidator.mount('age',   createValidator(type('number > 0')));
```

## Per-Context Schemas

Pass a function instead of a schema to build the schema lazily from the validator context (e.g. depending on the active group, sibling values, or `ctx.context`):

```typescript
container.mount(
    'password',
    createValidator((ctx) => ctx.group === 'create'
        ? z.string().min(12)
        : z.string().min(12).optional()),
);
```

The factory receives the full `ValidatorContext`:

```typescript
type StandardSchemaCreateFn<C = unknown> = (ctx: ValidatorContext<C>) => StandardSchemaV1;
```

`createValidator<C>(...)` is generic over the validup context type, so factories can read typed `ctx.context` when the parent container declares one (`Container<T, C>`).

## Error Mapping

When a schema's `~standard.validate` returns issues, the adapter converts each one into a validup `IssueItem` carrying the spec-portable subset:

| Standard Schema  | Validup `IssueItem` |
|------------------|---------------------|
| `message`        | `message`           |
| `path` (PropertyKey or `{ key }` PathSegment) | `path` (flattened to `PropertyKey[]`) |
| —                | `code` defaults to `IssueCode.VALUE_INVALID` |

Vendor-specific fields (zod's `expected`/`received`, valibot's `requirement`, …) aren't part of the spec, so they're not surfaced. If you need them, use the vendor-specific adapter (e.g. `@validup/zod`'s `buildIssuesForZodError`).

The adapter then throws a `ValidupError` with those issues; validup's container catches it and stitches the mount key into each issue's `path`.

## Choosing Between `@validup/zod` and `@validup/standard-schema`

| Want                                                  | Pick                       |
|-------------------------------------------------------|----------------------------|
| Vendor-portable adapter — swap libraries without touching mounts | `@validup/standard-schema` |
| Surface zod's `expected` / `received` on issues       | `@validup/zod`             |
| Bidirectional `validup ↔ zod` issue conversion        | `@validup/zod`             |
| zod 3.x (< 3.24, no Standard Schema support)          | `@validup/zod`             |

Both packages can coexist in the same project.

## API Reference

```typescript
function createValidator<C = unknown>(
    input: StandardSchemaV1 | ((ctx: ValidatorContext<C>) => StandardSchemaV1),
): Validator<C>;

function buildIssuesForStandardSchemaIssues(
    issues: ReadonlyArray<StandardSchemaV1.Issue>,
): Issue[];
```

## License

Made with 💚

Published under [MIT License](./LICENSE).
