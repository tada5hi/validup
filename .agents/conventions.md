# Conventions

## TypeScript

- `strict: true` enabled in every package (`tsconfig.build.json` extends root, sets `strict` again).
- `module: ESNext` + `moduleResolution: Node` + `experimentalDecorators` + `emitDecoratorMetadata` + `strictPropertyInitialization: false`.
- Source under `src/`, declarations and JS bundles emit to `dist/`.
- Build is split: `tsc --emitDeclarationOnly -p tsconfig.build.json` for `.d.ts`, then `rollup -c` for runtime bundles. Never commit `dist/`.

## Linting

`.eslintrc` extends `@tada5hi/eslint-config-typescript`. Project-specific overrides:

- `import/no-cycle`: error, `maxDepth: 1` — circular imports between modules are not tolerated even one hop deep.
- `class-methods-use-this`: off
- `no-shadow` / `no-use-before-define` / `@typescript-eslint/no-use-before-define`: off (forward references are common in container/issue modules)
- `@typescript-eslint/no-unused-vars`: off
- Ignored: `**/dist/*`, `**/*.d.ts`
- `NodeJS` is a declared global

Run: `npm run lint` (root, lints `./packages` only) or `npm run lint:fix`.

## Code Style

- **Indent**: 4 spaces, LF line endings, UTF-8, final newline (`.editorconfig`).
- **Single quotes**, trailing commas, semicolons (inherited from the shared config).
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

- **Conventional Commits** enforced via `commitlint.config.js` extending `@tada5hi/commitlint-config`.
- Common types in this repo's history: `feat`, `fix`, `chore`, `chore(deps)`, `fix(deps)`.
- Scope is optional but used (e.g. `fix(deps)`, `feat: container safe-parse method`).
- Releases are managed by **release-please** — do not edit `CHANGELOG.md` by hand. Each package is a release-please component (`validup`, `adapter-routup`, `adapter-validator`, `adapter-zod`).

## Branching & CI

- Tracked branches: `develop`, `master`, `next`, `beta`, `alpha`.
- `.github/workflows/main.yml` runs `install → build → (lint, tests)` on push/PR to those branches with Node 20.
- CodeQL and snyk also gate the project (badges in `README.md`).

## Husky

`prepare: husky install` runs on `npm install`. The `.husky/_/` stubs are present, but no project-level hooks (e.g. `.husky/pre-commit`) are committed at the moment — `lint-staged` is installed but unconfigured. If you add hooks, place them at `.husky/<hook-name>` (not under `_/`).

## Adding a New Package

1. Create `packages/<name>/` mirroring an existing adapter: `src/{module,error,index}.ts`, `test/{jest.config.js,unit/}`, `package.json`, `tsconfig.json`, `tsconfig.build.json`, `rollup.config.mjs`.
2. Add `npm run build` / `test` scripts identical to other packages so `nx run-many` picks them up.
3. Register the package in `release-please-config.json` under `packages` with a unique `component` name.
4. Add an entry to `.release-please-manifest.json` with the initial version.
5. Re-export everything via `src/index.ts`.
