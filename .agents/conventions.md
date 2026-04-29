# Conventions

## TypeScript

- Each package has a single `tsconfig.json` extending the root. The root extends `@tada5hi/tsconfig` and overrides:
  - `module: ESNext`, `moduleResolution: bundler`, `target: ES2022`
  - `experimentalDecorators` + `emitDecoratorMetadata`, `strictPropertyInitialization: false`
  - Strictness additions from the upstream config are intentionally relaxed: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noImplicitOverride` are all `false`.
  - `noEmit: true` and `allowImportingTsExtensions: true`.
- Source under `src/`, JS bundles + `.d.mts` declarations emit to `dist/` via tsdown. Never commit `dist/`.
- Build is split: `tsc --noEmit` typechecks; `tsdown` produces both `.mjs` and `.d.mts` from the same `src/index.ts` entry.

## Linting

`eslint.config.js` is an ESLint v10 flat config. It composes `@tada5hi/eslint-config` (which bundles javascript, stylistic, imports via `eslint-plugin-import-lite`, and unicorn rule sets) plus a small project override block:

- Ignored: `**/dist/**`, `**/*.d.ts`
- `NodeJS` is a declared global
- `@typescript-eslint/no-unused-vars`: off
- `@typescript-eslint/no-use-before-define`: off (forward references are common in container/issue modules)

Note: `import/no-cycle` is **not** available (`eslint-plugin-import-lite` ships only `first` / `newline-after-import` / `no-duplicates` / `no-mutable-exports`). If circular-import enforcement is needed back, install `eslint-plugin-import` separately.

Run: `npm run lint` (root, lints the whole workspace via flat config) or `npm run lint:fix`.

## Code Style

- **Indent**: 4 spaces, LF line endings, UTF-8, final newline (`.editorconfig`).
- **Single quotes**, trailing commas, semicolons (inherited from the shared config).
- **`@stylistic/object-curly-newline`** from the shared config requires single-line braces for objects with fewer than 3 properties — `npm run lint:fix` handles this automatically.
- **Copyright header** on every source file:
  ```ts
  /*
   * Copyright (c) <year>.
   * Author Peter Placzek (tada5hi)
   * For the full copyright and license information,
   * view the LICENSE file that was distributed with this source code.
   */
  ```
  New files should include this header. Update the year on substantive rewrites (existing files mix `2024`, `2025`, `2026`).
- **Index barrels**: every directory under `src/` has an `index.ts` re-exporting its members. Keep this pattern when adding modules — `src/index.ts` re-exports each subdir wholesale.
- **Imports**: prefer `import type { ... }` for type-only imports. The codebase is consistent about this (see `container/module.ts`).

## Commit Messages

- **Conventional Commits** enforced via `commitlint.config.mjs` extending `@tada5hi/commitlint-config`.
- Common types in this repo's history: `feat`, `fix`, `chore`, `chore(deps)`, `fix(deps)`.
- Scope is optional but used (e.g. `fix(deps)`, `feat: container safe-parse method`).
- Releases are managed by **release-please** — do not edit `CHANGELOG.md` by hand. Each package is a release-please component (`validup`, `adapter-routup`, `adapter-validator`, `adapter-zod`).
- Publishing is performed by [`tada5hi/monoship`](https://github.com/tada5hi/monoship) in the release workflow — it walks the workspace and publishes only packages whose version is missing from the registry.

## Branching & CI

- Tracked branches: `develop`, `master`, `next`, `beta`, `alpha`.
- `.github/workflows/main.yml` runs `install → build → (lint, tests)` on push/PR to those branches with Node 22.
- `.github/workflows/release.yml` runs release-please on push to `master`; on a release commit it builds and invokes the `tada5hi/monoship@v2` action to publish.
- CodeQL and snyk also gate the project (badges in `README.md`).

## Husky

`prepare: husky` (v9 syntax) runs on `npm install`. The `.husky/_/` stubs are present, but no project-level hooks (e.g. `.husky/pre-commit`) are committed at the moment. If you add hooks, place them at `.husky/<hook-name>` (not under `_/`).

## Adding a New Package

1. Create `packages/<name>/` mirroring an existing adapter: `src/{module,error,index}.ts`, `test/{vitest.config.ts,unit/}`, `package.json`, `tsconfig.json`, `tsdown.config.ts`.
2. `package.json` essentials: `"type": "module"`, `main: "dist/index.mjs"`, `types: "dist/index.d.mts"`, `exports` with `import` + `types`, `engines.node: ">=22.0.0"`, build/test scripts identical to other packages so `nx run-many` picks them up.
3. Register the package in `release-please-config.json` under `packages` with a unique `component` name.
4. Add an entry to `.release-please-manifest.json` with the initial version.
5. Re-export everything via `src/index.ts`.
