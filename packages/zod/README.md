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

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Per-Context Schemas](#per-context-schemas)
- [Error Mapping](#error-mapping)
  - [Zod → Validup](#zod--validup)
  - [Validup → Zod](#validup--zod)
- [API Reference](#api-reference)
- [Stability](#stability)
- [License](#license)

## Installation

```bash
npm install @validup/zod validup zod --save
```

| Peer dependency | Supported versions  |
|-----------------|---------------------|
| `validup`       | `^1.0.0`            |
| `zod`           | `^4.0.0`            |

> ℹ️ **zod 3 support was dropped in `@validup/zod@1.0`.** The adapter's `ZodIssue` type alias resolves to `zod/v4/core`'s `$ZodRawIssue`, which is not available in zod 3. Stay on `@validup/zod@<1` if you cannot upgrade zod; otherwise upgrade zod to `^4.0.0` alongside this package.

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

`createValidator` returns a validup `ValidatorDescriptor` — interchangeable with a bare `Validator` at the mount site. Mount it like any other validator:

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

## Result Caching

`createValidator` returns a `ValidatorDescriptor` (interchangeable with a bare `Validator` at the mount site). It participates in validup's [result cache](https://validup.tada5hi.net/guide/caching) by default — most zod schemas (`z.string().email()`, length / regex / enum) are deterministic, so cached `(value, context, group)` snapshots replay without re-running the schema.

```typescript
container.mount('email', createValidator(z.string().email()));                              // cached
container.mount('email', createValidator(asyncZodSchema, { sideEffect: true }));            // never cached
```

Pass `{ sideEffect: true }` for schemas with async refines or `superRefine` calls reading external state — the framework will then re-run them on every invocation, ignoring any cached entry.

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

> ⚠️ **`IssueGroup` round-trip is lossy.** validup's `Issue` is a discriminated union of `IssueItem` and `IssueGroup`. zod has no group equivalent, so `buildZodIssuesForIssue` recursively flattens every `IssueGroup` into its constituent `IssueItem`s when emitting zod issues — group-level metadata (`code: 'one_of_failed'`, `params.name`, etc.) is dropped. The reverse direction (zod → validup) never produces groups, so a `zod ← validup` round-trip on a flat issue list is preserved; a round-trip that involves grouped errors is not.

## API Reference

| Export                              | Description                                                                  |
|-------------------------------------|------------------------------------------------------------------------------|
| `createValidator(schema, options?)` | Wrap a `ZodType` (or `(ctx) => ZodType`) as a validup `ValidatorDescriptor`. `options.sideEffect: true` bypasses the result cache (use for async refines / `superRefine` reading external state). |
| `buildIssuesForZodError(e)`         | Convert a `ZodError` into an array of validup `Issue`s.                      |
| `buildZodIssuesForError(e)`         | Convert a `ValidupError` into an array of zod raw issues.                    |
| `buildZodIssuesForIssue(i)`         | Convert a single validup `Issue` into zod raw issues (recurses into groups). |
| `ZodIssue`                          | Re-exported alias for `$ZodRawIssue` from `zod/v4/core`.                     |

```typescript
function createValidator<C = unknown, Z extends ZodType = ZodType>(
    input: Z | ((ctx: ValidatorContext<C>) => Z),
    options?: { sideEffect?: boolean },
): ValidatorDescriptor<C, ZodOutput<Z>>;
```

## Stability

What's covered by semver:

- **Public exports** — `createValidator`, `buildIssuesForZodError`, `buildZodIssuesForError`, `buildZodIssuesForIssue`, and the `ZodIssue` type alias.
- **Error-mapping shape** — `IssueItem.path` mirrors the failing zod path; `IssueItem.expected` / `received` are populated when zod exposes them. Other zod-only fields (`code`, `params`, …) are intentionally not surfaced. `buildZodIssuesForError` reconstructs a zod-shaped representation from a `ValidupError` (`code: 'custom'`, the message, the path, and the original `received` value as `input`) — it does **not** recover the dropped zod fields. If you need them end-to-end, keep the `ZodError` available alongside the `ValidupError`.
- **Per-context schema factory** — `(ctx: ValidatorContext<C>) => ZodType` invocation contract.

Known lossy behavior:

- `buildZodIssuesForIssue` flattens `IssueGroup`s when emitting zod issues (zod has no group concept) — group-level `code` and `params` are dropped.

Peer dependency policy:

- `validup ^1.0.0`, `zod ^4.0.0`. zod 3.x was dropped in `@validup/zod@1.0` because the adapter's `ZodIssue` type alias resolves to `zod/v4/core`, which is not available in zod 3.

Deprecation policy: matches [`validup`](https://npmjs.com/package/validup) — at least one minor release of `@deprecated` notice before removal in a major.

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
