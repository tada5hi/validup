# @validup/adapter-validator 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

An [express-validator](https://express-validator.github.io) adapter for [validup](https://www.npmjs.com/package/validup).

Wrap any express-validator `ValidationChain` as a validup `Validator`, mount it on a `Container` path, and let validup orchestrate path expansion, group filtering, and structured error reporting while express-validator drives the rule chain.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Real-World Pattern](#real-world-pattern)
- [Per-Context Chains](#per-context-chains)
- [Error Mapping](#error-mapping)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install @validup/adapter-validator validup express-validator --save
```

| Peer dependency     | Supported versions |
|---------------------|--------------------|
| `express-validator` | `^7.3.1`           |

## Quick Start

```typescript
import { Container, ValidupError } from 'validup';
import { createValidationChain, createValidator } from '@validup/adapter-validator';

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

## Real-World Pattern

The dominant pattern is to subclass `Container<T>` and register chains inside `initialize()`:

```typescript
import { Container } from 'validup';
import { createValidationChain, createValidator } from '@validup/adapter-validator';

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
import { createValidationChain, createValidator } from '@validup/adapter-validator';

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

## API Reference

| Export                       | Description                                                                  |
|------------------------------|------------------------------------------------------------------------------|
| `createValidator(input)`     | Wrap a `ContextRunner` (or `(ctx) => ContextRunner`) as a validup `Validator`. |
| `createValidationChain()`    | Build a fresh express-validator `body()` chain pre-bound for use with the adapter. |
| `buildIssuesForErrors(es)`   | Convert an array of express-validator `ValidationError`s into validup `Issue`s. |

```typescript
function createValidator(
    input: ContextRunner | ((ctx: ValidatorContext) => ContextRunner),
): Validator;

function createValidationChain(): ValidationChain;
```

## License

Made with 💚

Published under [MIT License](./LICENSE).

[npm-version-src]: https://badge.fury.io/js/@validup%2Fadapter-validator.svg
[npm-version-href]: https://npmjs.com/package/@validup/adapter-validator
[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org
