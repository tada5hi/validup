<!-- NOTE: Keep this file and the .agents/*.md files updated as the project evolves. When adding patterns, packages, or conventions, update the relevant section. -->

# Validup — Agent Guide

Validup is a TypeScript validation library that lets you compose domain-specific validators by mounting `Validator` functions (or nested `Container`s) onto paths of an input object. The runtime expands paths via [pathtrace](https://www.npmjs.com/package/pathtrace), runs each mounted unit, collects structured `Issue`s on failure, and throws a `ValidupError` (extends `@ebec/core` `BaseError`; or returns a discriminated `Result` via `safeRun`). Integration packages bridge external validators (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`) and frameworks (`@validup/vue`) into this model.

**The `Issue` model itself is not defined in this repo.** It lives in [`@ebec/core`](https://github.com/tada5hi/ebec) — the same package `ValidupError` takes `BaseError` from, with zero dependencies and no `engines` floor — and every package here imports it from there directly. `validup` does **not** re-export it: that re-export existed for one release cycle and was removed for v2.0.0. A change to the shape of an issue, the `IssueCode` vocabulary, or any of the pure tree walks belongs in that repo. See [structure.md → the issue model](.agents/structure.md#the-issue-model-lives-in-ebeccore).

The repo is an **Nx-managed npm workspace monorepo** containing the core library, four integration packages (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`, `@validup/vue`), a private `docs/` workspace that builds the VitePress site published to GitHub Pages, and a private `playground/` tree for runnable demo apps (currently `playground/vite-vue`, a Vite + Vue 3 multi-route showcase of `@validup/vue`). All five packages are released together at one version — **1.0.0** on the registry, with an unreleased breaking change on `master` (the issue-model re-export removal) that makes the next cut **2.0.0**. The public surface is semver-protected — see the Stability section of each README for what that covers. All published packages are licensed Apache-2.0.

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

- **Node.js (package runtime)**: `>=24.0.0` (CI runs on 24)
- **Node.js (development tooling)**: `^24.11.0 || >=26.0.0`; `.nvmrc` selects Node 24.
- **Package manager**: `npm` workspaces (root `package.json` declares `workspaces: ["packages/*"]`)
- **Build**: `tsc --noEmit` for typecheck, then `tsdown` for ESM-only JS + `.d.mts` bundles
- **Test runner**: Vitest 5 (`globals: true`)
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

### Writing agent docs

Update these guides only when an invariant or a cross-cutting rule changes. Edit the existing statement and describe current behavior. Defect stories, test inventories and change history belong in PRs or commits. `npm run lint` enforces agent-doc size and history checks through the shared ESLint config.
