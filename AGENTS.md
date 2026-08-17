<!-- NOTE: Keep this file and the .agents/*.md files updated as the project evolves. When adding patterns, packages, or conventions, update the relevant section. -->

# Validup — Agent Guide

Validup is a TypeScript validation library that lets you compose domain-specific validators by mounting `Validator` functions (or nested `Container`s) onto paths of an input object. The runtime expands paths via [pathtrace](https://www.npmjs.com/package/pathtrace), runs each mounted unit, collects structured `Issue`s on failure, and throws a `ValidupError` (extends `@ebec/core` `BaseError`; or returns a discriminated `Result` via `safeRun`). Integration packages bridge external validators (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`) and frameworks (`@validup/vue`) into this model.

**The `Issue` model itself is not defined in this repo.** It lives in [`blemish`](https://github.com/tada5hi/blemish) — a standalone zero-dependency package with no `engines` floor — and `packages/validup/src/index.ts` re-exports it wholesale, so every import path and type identity is unchanged for consumers. A change to the shape of an issue, the `IssueCode` vocabulary, or any of the pure tree walks belongs in that repo. See [structure.md → the issue model](.agents/structure.md#the-issue-model-lives-in-blemish).

The repo is an **Nx-managed npm workspace monorepo** containing the core library, four integration packages (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`, `@validup/vue`), a private `docs/` workspace that builds the VitePress site published to GitHub Pages, and a private `playground/` tree for runnable demo apps (currently `playground/vite-vue`, a Vite + Vue 3 multi-route showcase of `@validup/vue`). All five packages are at **1.0.0** and released together, so the public surface is semver-protected — see the Stability section of each README for what that covers. All published packages are licensed Apache-2.0.

## Quick Reference

```bash
# Setup
npm install

# Build all packages (Nx run-many)
npm run build

# Run all tests
npm run test

# Typecheck the specs (validator-js + vue only — see .agents/testing.md)
npm run test:types

# Lint
npm run lint
npm run lint:fix
```

- **Node.js**: `>=24.0.0` (CI runs on 24)
- **Package manager**: `npm` workspaces (root `package.json` declares `workspaces: ["packages/*"]`)
- **Build**: `tsc --noEmit` for typecheck, then `tsdown` for ESM-only JS + `.d.mts` bundles
- **Test runner**: Vitest 4 (`globals: true`)
- **Task runner**: Nx (caches `build`, `lint`, `test`)
- **Lint**: ESLint v10 flat config, `@tada5hi/eslint-config`
- **Release**: release-please (component per package, see `release-please-config.json`); publishing via `tada5hi/monoship`

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Workspace layout, the four packages, and dependency layers
- **[Architecture](.agents/architecture.md)** — Container/Validator/Issue model, mount semantics, and integration-package contract
- **[Testing](.agents/testing.md)** — Per-package Vitest setup, coverage thresholds, and where specs live
- **[Conventions](.agents/conventions.md)** — ESLint rules, Conventional Commits, copyright header, release tooling

## Commits

- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)** (`@tada5hi/commitlint-config`); the type/scope drive release-please version bumps. See [conventions.md](.agents/conventions.md#commit-convention).
- Versioning, `CHANGELOG.md`, `package.json` version, and `.release-please-manifest.json` are owned by **release-please** — do not hand-edit them.
- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Do **not** add AI-attribution lines (e.g. `🤖 Generated with [Claude Code](...)`) to issue or pull request titles, bodies, or comments.
