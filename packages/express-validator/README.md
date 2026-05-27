# @validup/express-validator 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A [validup](https://www.npmjs.com/package/validup) integration for [express-validator](https://express-validator.github.io) — turn any `ValidationChain` into a validup `Validator`.

Wrap any express-validator `ValidationChain` as a validup `Validator`, mount it on a `Container` path, and let validup orchestrate path expansion, group filtering, and structured error reporting while express-validator drives the rule chain.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Real-World Pattern](#real-world-pattern)
- [Per-Context Chains](#per-context-chains)
- [Error Mapping](#error-mapping)
- [API Reference](#api-reference)
- [Stability](#stability)
- [License](#license)

## Installation

```bash
npm install @validup/express-validator validup express-validator --save
```

| Peer dependency     | Supported versions |
|---------------------|--------------------|
| `validup`           | `^1.0.0`           |
| `express-validator` | `^7.3.1`           |

## Quick Start

```typescript
import { Container, ValidupError } from 'validup';
import { createValidationChain, createValidator } from '@validup/express-validator';

const container = new Container<{ tags: string[] }>();

container.mount(
    'tags',
    createValidator(() => {
        const chain = createValidationChain();
        return chain.isArray({ min: 1, max: 10 });
    }),
);

const valid = await container.run({ tags: ['typescript', 'validation'] });
// valid is { tags: ['typescript', 'validation'] }
```

`createValidationChain()` returns an express-validator `body()` chain — pre-bound to read the value validup hands the validator. Build your rules on top of it like any other express-validator chain.

> ℹ️ **Deliberate alias.** `createValidationChain()` is a thin wrapper around express-validator's `body()` and adds no behavior on top of it. The function is kept for stylistic consistency with the rest of the `@validup/express-validator` API; calling `body()` from `express-validator` directly is equivalent and fully supported. Pick whichever spelling you find clearer for your codebase.

## Real-World Pattern

The dominant pattern is to subclass `Container<T>` and register chains inside `initialize()`:

```typescript
import { Container } from 'validup';
import { createValidationChain, createValidator } from '@validup/express-validator';

type User = {
    name: string;
    age: number;
    password: string;
};

class UserValidator extends Container<User> {
    protected override initialize() {
        super.initialize();

        this.mount('name', createValidator(() => {
            const chain = createValidationChain();
            return chain
                .exists()
                .notEmpty()
                .isLength({ min: 3, max: 128 });
        }));

        this.mount('age', createValidator(() => {
            const chain = createValidationChain();
            return chain
                .isNumeric()
                .optional({ values: 'null' });
        }));

        this.mount('password', createValidator(() => {
            const chain = createValidationChain();
            return chain.isLength({ min: 3, max: 128 });
        }));
    }
}

const valid = await new UserValidator().run(input);
```

## Per-Context Chains

Pass a function to `createValidator` to build the chain from the validator context — for example, to switch rules based on the active group:

```typescript
import { createValidationChain, createValidator } from '@validup/express-validator';

const tagsValidator = createValidator((ctx) => {
    const chain = createValidationChain().isArray({ min: 1, max: 10 });

    if (ctx.group === 'optional') {
        return chain.optional({ values: 'null' });
    }

    return chain;
});

container.mount('tags', { group: 'required' }, tagsValidator);
container.mount('tags', { group: 'optional' }, tagsValidator);

await container.run({ tags: null }, { group: 'optional' }); // ✅ tags === null
await container.run({ tags: null }, { group: 'required' }); // ❌ throws ValidupError
```

## Error Mapping

When the chain reports validation errors, the adapter converts each express-validator `ValidationError` into a validup `IssueItem` with `path`, `message`, and `received` fields. The adapter then throws a `ValidupError` containing those issues. All three error types are mapped:

- `field` — the failing field name becomes the issue `path`.
- `alternative` — nested errors are flattened into the issue list.
- `alternative_grouped` — nested error groups are recursively flattened.

```typescript
try {
    await container.run({ tags: [] });
} catch (error) {
    if (error instanceof ValidupError) {
        error.issues.forEach((issue) => {
            console.log(issue.path, issue.message, issue.received);
        });
    }
}
```

When the chain succeeds **without** transforming the value, the adapter returns the sanitized field value from express-validator's context — so chains like `.toInt()` or `.trim()` carry through to the validup output.

### Mapping a code onto the validup vocabulary

express-validator doesn't preserve the failing validator's identity through `ValidationError` (no `.isEmail()` → `'email'` propagation), so the adapter can't auto-derive a code. By default every `field` failure surfaces as `IssueCode.VALUE_INVALID` with the raw `msg` string as the displayable message.

Callers who want one of validup's vocabulary codes ([see the table](https://www.npmjs.com/package/validup#issue-codes)) can opt in by passing a structured `{ code, message }` payload to `.withMessage(...)`:

```typescript
import { body } from 'express-validator';
import { createValidator } from '@validup/express-validator';
import { IssueCode } from 'validup';

container.mount('email', createValidator(() => body()
    .isEmail()
    .withMessage({ code: IssueCode.EMAIL, message: 'Invalid email' })));

container.mount('name', createValidator(() => body()
    .isLength({ min: 3 })
    .withMessage({ code: IssueCode.MIN_LENGTH, message: 'Too short' })));
```

The adapter detects the `{ code, message }` shape and lifts both onto the resulting `IssueItem`. Plain-string `.withMessage('Name too short')` is fully backward-compatible and falls back to `VALUE_INVALID`.

The `alternative` / `alternative_grouped` cases produce an `IssueGroup` with `code: IssueCode.ONE_OF_FAILED` regardless of the `.withMessage(...)` payload — there's only one outer code per `oneOf` chain and the adapter knows it.

## API Reference

| Export                       | Description                                                                  |
|------------------------------|------------------------------------------------------------------------------|
| `createValidator(input)`     | Wrap a `ContextRunner` (or `(ctx) => ContextRunner`) as a validup `Validator`. |
| `createValidationChain()`    | Build a fresh express-validator `body()` chain pre-bound for use with the adapter. |
| `buildIssuesForErrors(es)`   | Convert an array of express-validator `ValidationError`s into validup `Issue`s. |

```typescript
function createValidator<C = unknown>(
    input: ContextRunner | ((ctx: ValidatorContext<C>) => ContextRunner),
): Validator<C>;

function createValidationChain(): ValidationChain;
```

## Stability

What's covered by semver:

- **Public exports** — `createValidator`, `createValidationChain`, and `buildIssuesForErrors`.
- **Error-mapping shape** — all three express-validator error types (`field`, `alternative`, `alternative_grouped`) are mapped:
  - `field` → flat `IssueItem` with the failing field name parsed into `path: PropertyKey[]` (numeric bracket indices become numbers).
  - `alternative` and `alternative_grouped` → `IssueGroup` with `code: IssueCode.ONE_OF_FAILED`.
  - `unknown_fields` → path-less `IssueItem` carrying the message.
- **Return-value contract** — when the chain selects a single field and no errors are reported, the **sanitized** field value is returned; otherwise the original `ctx.value` passes through. This shape-shift is intentional so chains like `.toInt().trim()` carry through to the validup output. Callers that need the original value regardless can read `ctx.value` from outside the validator.
- **Per-context chain factory** — `(ctx: ValidatorContext<C>) => ContextRunner` invocation contract.

Peer dependency policy:

- `validup ^1.0.0`, `express-validator ^7.3.1`.

Deprecation policy: matches [`validup`](https://npmjs.com/package/validup) — at least one minor release of `@deprecated` notice before removal in a major.

## License

Made with 💚

Published under [Apache 2.0 License](./LICENSE).

[npm-version-src]: https://badge.fury.io/js/@validup%2Fexpress-validator.svg
[npm-version-href]: https://npmjs.com/package/@validup/express-validator
[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org
