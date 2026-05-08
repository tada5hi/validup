<!-- NOTE: Keep this file and the .agents/*.md files updated as the project evolves. When adding patterns, packages, or conventions, update the relevant section. -->

# Validup — Agent Guide

Validup is a TypeScript validation library that lets you compose domain-specific validators by mounting `Validator` functions (or nested `Container`s) onto paths of an input object. The runtime expands paths via [pathtrace](https://www.npmjs.com/package/pathtrace), runs each mounted unit, collects structured `Issue`s on failure, and throws a `ValidupError` (extends `@ebec/core` `BaseError`; or returns a discriminated `Result` via `safeRun`). Integration packages bridge external validators (`@validup/standard-schema`, `@validup/zod`, `@validup/express-validator`) and frameworks (`@validup/vue`) into this model.

The repo is an **Nx-managed npm workspace monorepo** containing the core library, four integration packages (`@validup/standard-schema`, `@validup/zod`, `@validup/express-validator`, `@validup/vue`), and a private `docs/` workspace that builds the VitePress site published to GitHub Pages. The project is pre-1.0 and explicitly marked as work-in-progress. All packages are licensed Apache-2.0.

## Quick Reference

```bash
# Setup
npm install

# Build all packages (Nx run-many)
npm run build

# Run all tests
npm run test

# Lint
npm run lint
npm run lint:fix
```

- **Node.js**: `>=22.0.0` (CI runs on 22)
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

- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
