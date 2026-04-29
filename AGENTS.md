<!-- NOTE: Keep this file and the .agents/*.md files updated as the project evolves. When adding patterns, packages, or conventions, update the relevant section. -->

# Validup — Agent Guide

Validup is a TypeScript validation library that lets you compose domain-specific validators by mounting `Validator` functions (or nested `Container`s) onto paths of an input object. The runtime expands paths via [pathtrace](https://www.npmjs.com/package/pathtrace), runs each mounted unit, collects structured `Issue`s on failure, and throws a `ValidupError` (or returns a discriminated `Result` via `safeRun`). Adapter packages bridge external validators (zod, express-validator) and frameworks (routup) into this model.

The repo is an **Nx-managed npm workspace monorepo** containing the core library and three adapters. The project is pre-1.0 and explicitly marked as work-in-progress.

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

- **Node.js**: `>=18.0.0` (CI runs on 20)
- **Package manager**: `npm` workspaces (root `package.json` declares `workspaces: ["packages/*"]`)
- **Build**: TypeScript declarations via `tsc --emitDeclarationOnly`, JS bundles via Rollup + `@rollup/plugin-swc` (CJS + ESM dual output)
- **Test runner**: Jest 30 with `@swc/jest` transformer
- **Task runner**: Nx (caches `build`, `lint`, `test`)
- **Release**: release-please (component per package, see `release-please-config.json`)

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Workspace layout, the four packages, and dependency layers
- **[Architecture](.agents/architecture.md)** — Container/Validator/Issue model, mount semantics, and adapter contract
- **[Testing](.agents/testing.md)** — Per-package Jest setup, coverage thresholds, and where specs live
- **[Conventions](.agents/conventions.md)** — ESLint rules, Conventional Commits, copyright header, release tooling
