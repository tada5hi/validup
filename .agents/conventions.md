# Conventions

## Documentation surfaces

Three audiences read documentation in this repo. After any code, tooling, or API change, update every surface that mentions the changed thing — in the **same pass** as the code change, not as a follow-up.

| Surface                                        | Audience                | Update when …                                                                                                |
|------------------------------------------------|-------------------------|--------------------------------------------------------------------------------------------------------------|
| Root `README.md` + each `packages/*/README.md` | npm / GitHub readers    | Public API, exports, install, scripts, supported Node versions, integration list, dependency layers change.  |
| VitePress site under `docs/src/**`             | End users on the docs site | New / removed concepts, options, run modes, integrations; user-facing examples; signatures; cross-links.  |
| `AGENTS.md` + `.agents/{structure,architecture,testing,conventions}.md` (this file) | Future agents & human contributors | Repo layout, package roles, runtime behavior, testing setup, lint/format rules, release/CI mechanics change. |

When adding a new VitePress page, slot it into the sidebar in `docs/src/.vitepress/config.mts` and cross-link it from neighboring pages (the guide overview's "where to next" list, related-page `::: tip` blocks). When adding a new package or moving a module between packages, update `.agents/structure.md` and `.agents/architecture.md` so the dependency-layer diagram and per-package tables stay accurate. Stale docs are treated as a defect, not a separate task — verify all three surfaces before reporting the change as done.

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
- **Copyright header** on every `.ts` / `.tsx` / `.js` / `.jsx` / `.mjs` / `.cjs` file in the repo — this includes `src/`, `test/`, and build/test config files (`tsdown.config.ts`, `test/vitest.config.ts`, `eslint.config.js`, `commitlint.config.mjs`):
  ```ts
  /*
   * Copyright (c) <year>.
   * Author Peter Placzek (tada5hi)
   * For the full copyright and license information,
   * view the LICENSE file that was distributed with this source code.
   */
  ```
  New files must include this header. Update the year on substantive rewrites (existing files mix `2024`, `2025`, `2026`).
- **Index barrels**: every directory under `src/` has an `index.ts` re-exporting its members. Keep this pattern when adding modules — `src/index.ts` re-exports each subdir wholesale.
- **Imports**: prefer `import type { ... }` for type-only imports. The codebase is consistent about this (see `container/module.ts`).

## Commit Messages

- **Conventional Commits** enforced via `commitlint.config.mjs` extending `@tada5hi/commitlint-config`.
- Common types in this repo's history: `feat`, `fix`, `chore`, `chore(deps)`, `fix(deps)`.
- Scope is optional but used (e.g. `fix(deps)`, `feat: container safe-parse method`).
- Releases are managed by **release-please** — do not edit `CHANGELOG.md` by hand. Each package is a release-please component (`validup`, `routup`, `express-validator`, `vue`, `zod`).
- Publishing is performed by [`tada5hi/monoship`](https://github.com/tada5hi/monoship) in the release workflow — it walks the workspace and publishes only packages whose version is missing from the registry.

## Branching & CI

- Tracked branches: `develop`, `master`, `next`, `beta`, `alpha`.
- `.github/workflows/main.yml` runs `install → build → (lint, tests)` on push/PR to those branches with Node 22.
- `.github/workflows/release.yml` runs release-please on push to `master`; on a release commit it builds and invokes the `tada5hi/monoship@v2` action to publish.
- `.github/workflows/docs.yml` builds the VitePress site under `docs/` and deploys it to GitHub Pages on push to `master` (uses `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`; needs Pages source set to "GitHub Actions" in repo settings).
- `.github/workflows/continuous-release.yml` runs `npx pkg-pr-new publish './packages/*'` on push to tracked branches and on PR open/synchronize to publish per-commit preview packages via the [pkg-pr-new GitHub App](https://github.com/apps/pkg-pr-new). The App must be installed on the repo for the publish step to authenticate; it comments PRs with the preview install URLs.
- CodeQL and snyk also gate the project (badges in `README.md`).

## Husky

`prepare: husky` (v9 syntax) runs on `npm install`. The `.husky/_/` stubs are present, but no project-level hooks (e.g. `.husky/pre-commit`) are committed at the moment. If you add hooks, place them at `.husky/<hook-name>` (not under `_/`).

## Adding a New Package

1. Create `packages/<name>/` mirroring an existing integration package: `src/{module,error,index}.ts`, `test/{vitest.config.ts,unit/}`, `package.json`, `tsconfig.json`, `tsdown.config.ts`.
2. `package.json` essentials: `"type": "module"`, `main: "dist/index.mjs"`, `types: "dist/index.d.mts"`, `exports` with `import` + `types`, `engines.node: ">=22.0.0"`, build/test scripts identical to other packages so `nx run-many` picks them up.
3. Register the package in `release-please-config.json` under `packages` with a unique `component` name.
4. Add an entry to `.release-please-manifest.json` with the initial version.
5. Re-export everything via `src/index.ts`.

## References
External project references live in .agents/references/. When looking up source code in a referenced project (e.g., vuelidate), always update the corresponding reference file with:

The source file path / function name in the external project
The corresponding Validup file path / function name
Any behavioral differences between the implementations
This builds a cumulative mapping over time so future work can quickly find corresponding code without re-searching.
