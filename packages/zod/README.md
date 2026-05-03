# @validup/zod 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A [validup](https://www.npmjs.com/package/validup) integration for [zod](https://zod.dev) — turn any zod schema into a validup `Validator`.

Wrap any zod schema as a validup `Validator`, mount it on a `Container` path, and let validup orchestrate path expansion, group filtering, and error aggregation while zod does the actual schema parsing.

> ℹ️ **Already on zod 3.24+ and don't need vendor-specific fields?**
>
> [`@validup/standard-schema`](https://npmjs.com/package/@validup/standard-schema) covers zod via the [Standard Schema](https://standardschema.dev) protocol and works the same against valibot, arktype, and effect-schema. Pick `@validup/zod` when you specifically need `expected`/`received` on issues or the bidirectional `validup ↔ zod` mapping.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Per-Context Schemas](#per-context-schemas)
- [Error Mapping](#error-mapping)
  - [Zod → Validup](#zod--validup)
  - [Validup → Zod](#validup--zod)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install @validup/zod validup zod --save
```

| Peer dependency | Supported versions  |
|-----------------|---------------------|
| `zod`           | `^3.25.0 \|\| ^4.0.0` |

## Quick Start

```typescript
import { Container, ValidupError } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

const user = new Container<{ email: string; age: number }>();

user.mount('email', createValidator(z.string().email()));
user.mount('age',   createValidator(z.number().int().positive()));

try {
    const valid = await user.run({
        email: 'peter@example.com',
        age: 28,
    });
    // valid is { email, age }
} catch (error) {
    if (error instanceof ValidupError) {
        console.log(error.issues);
        // [{ type: 'item', path: ['email'], message: 'Invalid email address', ... }]
    }
}
```

`createValidator` returns a validup `Validator`. Mount it like any other validator:

```typescript
container.mount('field', { group: 'create' }, createValidator(z.string()));
container.mount('opt',   { optional: true },  createValidator(z.number()));
```

## Per-Context Schemas

Pass a function instead of a schema to build the schema lazily from the validator context (e.g. depending on the active group, sibling values, or path):

```typescript
import { createValidator } from '@validup/zod';
import { z } from 'zod';

const passwordValidator = createValidator((ctx) => {
    if (ctx.group === 'create') {
        return z.string().min(12);   // strict for new users
    }
    return z.string().min(12).optional(); // lenient on update
});

container.mount('password', { group: 'create' }, passwordValidator);
container.mount('password', { group: 'update' }, passwordValidator);
```

The factory receives the full `ValidatorContext`:

```typescript
type ZodCreateFn<C = unknown> = (ctx: ValidatorContext<C>) => ZodType;
```

`createValidator<C>(...)` is generic over the validup context type, so factories can read typed `ctx.context` when the parent container declares one (`Container<T, C>`).

## Error Mapping

### Zod → Validup

When a schema fails to parse, the adapter calls `safeParseAsync`, then converts each `ZodIssue` into a validup `IssueItem` with the original `path`, `message`, and (when present) `expected` / `received` fields. The adapter then throws a `ValidupError` containing those issues.

```typescript
container.mount('user', createValidator(z.object({
    name: z.string(),
    age: z.number().min(18),
})));

try {
    await container.run({ user: { name: 42, age: 10 } });
} catch (error) {
    if (error instanceof ValidupError) {
        // error.issues:
        // [
        //   { type: 'group', path: ['user'], issues: [
        //     { type: 'item', path: ['user', 'name'], message: 'Expected string, received number', ... },
        //     { type: 'item', path: ['user', 'age'],  message: 'Number must be greater than or equal to 18', ... },
        //   ]}
        // ]
    }
}
```

Paths from the wrapped zod schema are merged with the parent container's path, so deeply nested validation produces a fully-qualified `path` array on every issue.

### Validup → Zod

Going the other way, you can convert a `ValidupError` (or a single `Issue`) into zod's raw issue format — useful when integrating validup output into zod-driven pipelines such as form libraries:

```typescript
import { buildZodIssuesForError, buildZodIssuesForIssue } from '@validup/zod';

try {
    await container.run(input);
} catch (error) {
    if (error instanceof ValidupError) {
        const zodIssues = buildZodIssuesForError(error);
        // [{ code: 'custom', message: '...', path: [...], input: ... }, ...]
    }
}
```

## API Reference

| Export                       | Description                                                                  |
|------------------------------|------------------------------------------------------------------------------|
| `createValidator(schema)`    | Wrap a `ZodType` (or `(ctx) => ZodType`) as a validup `Validator`.           |
| `buildIssuesForZodError(e)`  | Convert a `ZodError` into an array of validup `Issue`s.                      |
| `buildZodIssuesForError(e)`  | Convert a `ValidupError` into an array of zod raw issues.                    |
| `buildZodIssuesForIssue(i)`  | Convert a single validup `Issue` into zod raw issues (recurses into groups). |
| `ZodIssue`                   | Re-exported alias for `$ZodRawIssue` from `zod/v4/core`.                     |

```typescript
function createValidator<C = unknown>(input: ZodType | ((ctx: ValidatorContext<C>) => ZodType)): Validator<C>;
```

## License

Made with 💚

Published under [Apache 2.0 License](./LICENSE).

[npm-version-src]: https://badge.fury.io/js/@validup%2Fzod.svg
[npm-version-href]: https://npmjs.com/package/@validup/zod
[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org
