# Project Structure

## Repository Layout

```
validup/
├── packages/
│   ├── validup/              # Core library (npm: validup)
│   ├── zod/                  # zod bridge (npm: @validup/zod)
│   ├── express-validator/    # express-validator bridge (npm: @validup/express-validator)
│   ├── routup/               # routup HTTP request integration (npm: @validup/routup)
│   └── vue/                  # Vue 3 composable (npm: @validup/vue)
├── nx.json                   # Nx caching config (build, lint, test cacheable)
├── tsconfig.json             # Shared TS base — extends @tada5hi/tsconfig, noEmit
├── release-please-config.json
├── commitlint.config.mjs     # extends @tada5hi/commitlint-config
└── eslint.config.js          # ESLint v10 flat config — uses @tada5hi/eslint-config
```

## Packages

| Package                        | Path                          | Public name                  | Depends on (runtime)                | Peer deps                                       |
|--------------------------------|-------------------------------|------------------------------|-------------------------------------|-------------------------------------------------|
| Core                           | `packages/validup`            | `validup`                    | `pathtrace`, `smob`                 | —                                               |
| Zod integration                | `packages/zod`                | `@validup/zod`               | `validup`                           | `zod ^3.25.0 \|\| ^4.0.0`                       |
| express-validator integration  | `packages/express-validator`  | `@validup/express-validator` | `validup`, `smob`                   | `express-validator ^7.3.1`                      |
| Routup integration             | `packages/routup`             | `@validup/routup`            | (none — `validup` is peer)          | `validup`, `routup`, `@routup/basic`            |
| Vue integration                | `packages/vue`                | `@validup/vue`               | `validup`                           | `vue ^3.3`                                      |

All packages are `"type": "module"` and publish **ESM-only** (`dist/index.mjs` + `dist/index.d.mts`). No CJS output.

## Dependency Layers

```
zod ──┐
express-validator ──┤
routup ─────┼──► validup ──► pathtrace, smob
vue ────────┘
```

- `validup` is the only **leaf** package — integration packages never depend on each other.
- `nx run-many -t build` resolves order via `dependsOn: ["^build"]` in `nx.json`, so editing the core forces integration-package rebuilds.
- When changing core types/exports, integration packages may need updates (especially `@validup/zod` which uses `defineIssueItem`, `isIssueItem`, `hasOwnProperty` from the core, and `@validup/vue` which uses `flattenIssueItems`/`isIssueItem`/`isIssueGroup` to reactively derive field-level errors).

## Per-Package Files

Each package has the same layout:

```
packages/<pkg>/
├── package.json
├── tsconfig.json         # extends ../../tsconfig.json, includes src/**/*
├── tsdown.config.ts      # entry: src/index.ts, format: esm, dts: true
├── src/
│   ├── index.ts          # barrel re-export
│   └── ...
└── test/
    ├── vitest.config.ts  # globals: true, include: test/unit/**/*.{spec,test}.{js,ts}
    └── unit/
        └── *.spec.ts
```

Build scripts per package:
- `build:types` → `tsc --noEmit` (typecheck only — emission is handled by tsdown)
- `build:js` → `tsdown`
- `build` → runs both sequentially

## Core Package Layout (`packages/validup/src/`)

| Subdir       | Responsibility                                                                              |
|--------------|---------------------------------------------------------------------------------------------|
| `container/` | `Container` class (`module.ts`), `IContainer`/`Mount`/`MountOptions` types, `isContainer`   |
| `error/`     | `ValidupError` class (`base.ts`) and `isError`/`isValidupError` guards (`check.ts`)         |
| `issue/`     | `Issue` types (item/group), `IssueCode` enum, `defineIssueItem`/`defineIssueGroup` factories, `isIssue`/`isIssueItem`/`isIssueGroup` guards |
| `helpers/`   | `buildErrorMessageForAttribute(s)`, `isOptionalValue`, `stringifyPath`                      |
| `utils/`     | Internal helpers — `isObject`, `hasOwnProperty`                                             |
| `constants.ts` | `GroupKey.WILDCARD = '*'`, `OptionalValue` enum (`UNDEFINED` / `NULL` / `FALSY`)          |
| `types.ts`   | `Validator`, `ValidatorContext`, `ObjectLiteral`                                            |
| `index.ts`   | Re-exports every subdir (barrel — preserve when adding modules)                             |

## Integration Package Layout

Each integration package follows the same shape:

```
src/
├── module.ts    # createValidator() or *Adapter class — the public entry
├── error.ts     # buildIssuesFor*Error() — translate foreign errors into validup Issues
├── types.ts     # (optional) package-specific option types
├── constants.ts # (optional) e.g. Location enum in `@validup/routup`
└── index.ts     # Barrel re-export
```

- **@validup/zod**: `createValidator(zod | (ctx) => zod)` calls `safeParseAsync`; on failure converts each `ZodIssue` (`$ZodRawIssue` from `zod/v4/core`) into a validup `IssueItem`. Also exports `buildZodIssuesForError` for the reverse direction.
- **@validup/express-validator**: `createValidator(chain | (ctx) => chain)` runs an express-validator `ContextRunner` with `body: ctx.value`, then translates `ValidationError` (`field` / `alternative` / `alternative_grouped`) into issues. Also exports `createValidationChain()`.
- **@validup/routup**: `RoutupContainerAdapter` wraps a `Container`; `run(req, options)` reads from `Location` (`body` / `cookies` / `params` / `query`, default `body`) and tries each location until one succeeds.
- **@validup/vue**: `useValidup(container, state, options?)` is a Vue 3 composable returning a vuelidate-shaped `ValidupComposable<T>` (`$invalid`, `$dirty`, `$pending`, `$errors`, per-field `$model`/`$touch`/`$reset`, plus `$crossCuttingErrors` and `$groupErrors`). Options: `group`, `debounce`, `name`, `stopPropagation`, `detached`, `lazy`, `autoDirty`, `scope`. `stopPropagation` skips upward `inject()` only; `detached` skips both `inject()` and `provide()` (invisible to ancestors *and* descendants). Layout differs slightly: `module.ts` (composable), `helpers/severity.ts` (`getValidupSeverity`), `helpers/child.ts` (`PARENT_INJECTION_KEY` + `extractValidupResultsFromChild`), `types.ts`. No `error.ts` — issues come pre-shaped from the wrapped `Container`.

## Tests

Tests live under each package in `test/` (not a top-level `tests/` dir):

- `packages/validup/test/unit/*.spec.ts` — covers the core (module, group, mount-key, optional, one-of, paths-to-include, error, issue, initialize)
- `packages/validup/test/data/` — shared fixtures (`string-validator.ts`)
- Integration packages each have their own `test/vitest.config.ts` and `test/unit/*.spec.ts`
- `@validup/vue` uses `environment: 'happy-dom'` in its vitest config (the only package that needs a DOM); the others use the default Node env.
