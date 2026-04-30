# Validup 🛡️

[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A composable, path-based validation library for TypeScript.

Mount validators and nested containers onto object paths, run them in groups, collect structured issues, and bridge to your favorite validator (zod, express-validator) or framework (routup) — all without decorators or schema DSLs.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

## Core Philosophy

Most validation libraries make you choose between two extremes: a schema DSL that bakes in every rule, or a hand-rolled function that tangles parsing, validation, and transformation. Validup picks a different point — **mount any validator function onto any path of any input, compose containers, and let the runtime handle path expansion, error aggregation, and group filtering.** You bring the validators (or wrap an existing library via an integration package); validup orchestrates them.

**Table of Contents**

- [Packages](#packages)
- [Installation](#installation)
- [At a Glance](#at-a-glance)
- [Why Validup](#why-validup)
- [Repository Layout](#repository-layout)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Packages

This monorepo publishes one core library and four integration packages:

| Package                                                      | Version                                       | Description                                                              |
|--------------------------------------------------------------|-----------------------------------------------|--------------------------------------------------------------------------|
| [`validup`](./packages/validup)                              | [![npm][validup-npm-src]][validup-npm-href]   | Core: `Container`, `Validator`, `Issue`, `ValidupError`                  |
| [`@validup/zod`](./packages/zod)                             | [![npm][zod-npm-src]][zod-npm-href]           | Bridge to [zod](https://zod.dev) schemas                                 |
| [`@validup/express-validator`](./packages/express-validator) | [![npm][ev-npm-src]][ev-npm-href]             | Bridge to [express-validator](https://express-validator.github.io) chains |
| [`@validup/routup`](./packages/routup)                       | [![npm][routup-npm-src]][routup-npm-href]     | Run a `Container` against a [routup](https://routup.net) request         |
| [`@validup/vue`](./packages/vue)                             | [![npm][vue-npm-src]][vue-npm-href]           | [Vue 3](https://vuejs.org) composable for client-side forms              |

## Installation

Install the core package:

```bash
npm install validup --save
```

Optionally add an integration:

```bash
npm install @validup/zod --save                # zod schemas
npm install @validup/express-validator --save  # express-validator chains
npm install @validup/routup --save             # routup HTTP requests
npm install @validup/vue --save                # Vue 3 forms
```

## At a Glance

```typescript
import { Container, ValidupError } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

const user = new Container<{ name: string; email: string; age: number }>();

user.mount('name', createValidator(z.string().min(2)));
user.mount('email', createValidator(z.string().email()));
user.mount('age', { optional: true }, createValidator(z.number().int().positive()));

try {
    const valid = await user.run({
        name: 'Peter',
        email: 'peter@example.com',
    });
    // valid is { name, email } — `age` was optional and omitted
} catch (error) {
    if (error instanceof ValidupError) {
        console.error(error.issues);
    }
}
```

## Why Validup

| Feature                  | What it gives you                                                                            |
|--------------------------|----------------------------------------------------------------------------------------------|
| 🧩 **Composable**        | Mount validators and nested `Container`s on any path. Stay flat or nest as deep as you like. |
| 🌐 **Universal**         | Pure JS — runs in Node.js, browsers, Deno, Bun, and edge runtimes.                            |
| 🎭 **Integration-ready** | First-class bridges to zod, express-validator, routup, and Vue. Trivial to add more.         |
| 🛤️ **Path-based**        | Mount via dotted paths (`a.b.c`), brackets (`foo[0]`), or globs (`**.foo`).                    |
| 🚦 **Group-aware**       | Run different validations for `create` / `update` / custom groups from the same container.   |
| ❓ **Optional handling** | Per-mount control over `undefined` / `null` / falsy semantics.                                 |
| 📋 **Structured errors** | Discriminated `Issue` items and groups with code, path, message, expected, received.          |
| 🛡️ **Type-safe**         | `Container<T>` propagates the output shape; mount paths are checked against `T`.              |

## Repository Layout

```
validup/
├── packages/
│   ├── validup/              # Core library
│   ├── zod/                  # @validup/zod
│   ├── express-validator/    # @validup/express-validator
│   ├── routup/               # @validup/routup
│   └── vue/                  # @validup/vue
├── nx.json                   # Nx caching for build / lint / test
└── release-please-config.json
```

The five packages are managed as an [Nx](https://nx.dev) workspace under npm workspaces. Integration packages depend on `validup`; the core has no peer dependencies.

## Development

```bash
# Install workspace dependencies
npm install

# Build every package (Nx topological build)
npm run build

# Run all test suites
npm run test

# Lint
npm run lint
npm run lint:fix
```

- **Node.js**: `>=22.0.0` (CI runs on 22)
- **Test runner**: [Vitest 4](https://vitest.dev)
- **Bundler**: [tsdown](https://tsdown.dev) — ESM-only output (`dist/index.mjs` + `dist/index.d.mts`)
- **Lint**: ESLint v10 flat config
- **Releases**: managed by [release-please](https://github.com/googleapis/release-please) — one component per package; published via [`tada5hi/monoship`](https://github.com/tada5hi/monoship)

## Contributing

Issues and pull requests are welcome. Please follow [Conventional Commits](https://conventionalcommits.org) — commit messages are linted via `commitlint`. CI runs install → build → lint → test on every PR.

For security vulnerabilities, please email contact@tada5hi.net rather than opening a public issue (see [SECURITY.md](./SECURITY.md)).

## License

Made with 💚

Published under [MIT License](./LICENSE).

[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org

[validup-npm-src]: https://badge.fury.io/js/validup.svg
[validup-npm-href]: https://npmjs.com/package/validup
[zod-npm-src]: https://badge.fury.io/js/@validup%2Fzod.svg
[zod-npm-href]: https://npmjs.com/package/@validup/zod
[ev-npm-src]: https://badge.fury.io/js/@validup%2Fexpress-validator.svg
[ev-npm-href]: https://npmjs.com/package/@validup/express-validator
[routup-npm-src]: https://badge.fury.io/js/@validup%2Froutup.svg
[routup-npm-href]: https://npmjs.com/package/@validup/routup
[vue-npm-src]: https://badge.fury.io/js/@validup%2Fvue.svg
[vue-npm-href]: https://npmjs.com/package/@validup/vue
