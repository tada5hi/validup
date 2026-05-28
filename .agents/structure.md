# Project Structure

## Repository Layout

```
validup/
├── packages/
│   ├── validup/              # Core library (npm: validup)
│   ├── standard-schema/      # Standard Schema bridge (npm: @validup/standard-schema)
│   ├── zod/                  # zod bridge (npm: @validup/zod)
│   ├── validator-js/         # validator.js bridge (npm: @validup/validator-js)
│   └── vue/                  # Vue 3 composable (npm: @validup/vue)
├── docs/                     # VitePress site (private workspace, npm: @validup/docs)
├── nx.json                   # Nx caching config (build, lint, test cacheable)
├── tsconfig.json             # Shared TS base — extends @tada5hi/tsconfig, noEmit
├── release-please-config.json
├── commitlint.config.mjs     # extends @tada5hi/commitlint-config
└── eslint.config.js          # ESLint v10 flat config — uses @tada5hi/eslint-config
```

## Packages

| Package                        | Path                          | Public name                  | Depends on (runtime)                | Peer deps                                       |
|--------------------------------|-------------------------------|------------------------------|-------------------------------------|-------------------------------------------------|
| Core                           | `packages/validup`            | `validup`                    | `@ebec/core`, `pathtrace`, `smob`   | —                                               |
| Standard Schema integration    | `packages/standard-schema`    | `@validup/standard-schema`   | `@standard-schema/spec`             | `validup ^1.0.0`                                |
| Zod integration                | `packages/zod`                | `@validup/zod`               | —                                   | `validup ^1.0.0`, `zod ^4.0.0`                  |
| validator.js integration       | `packages/validator-js`       | `@validup/validator-js`      | —                                   | `validup ^1.0.0`, `validator ^13.0.0`           |
| Vue integration                | `packages/vue`                | `@validup/vue`               | —                                   | `validup ^1.0.0`, `vue ^3.3`                    |

All packages are `"type": "module"` and publish **ESM-only** (`dist/index.mjs` + `dist/index.d.mts`). No CJS output. License: Apache-2.0 across the board (root + every package).

The `docs/` workspace is `private: true` (excluded from `release-please-config.json` and from monoship). It depends on the local `validup` workspace package via `"validup": "*"` so the Hero playground can SSR a real `Container.safeRunSync(...)` against the current core.

## Dependency Layers

```
standard-schema ──┐
zod ──────────────┤
validator-js ─────┼──► validup ──► @ebec/core, pathtrace, smob
vue ──────────────┘
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
| `issue/`     | `Issue` types (item/group), `IssueCode` enum, `defineIssueItem`/`defineIssueGroup` factories, `isIssue`/`isIssueItem`/`isIssueGroup` guards, `flattenIssueItems`/`flattenIssueGroups` |
| `helpers/`   | `buildErrorMessageForAttribute(s)`, `isOptionalValue`, `stringifyPath`, `resolveDefaults`, `resolvePathFilter` |
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
└── index.ts     # Barrel re-export
```

- **@validup/standard-schema**: `createValidator(schema | (ctx) => schema)` calls `schema['~standard'].validate(ctx.value)` against any [Standard Schema](https://standardschema.dev) library (zod 3.24+, valibot, arktype, effect-schema, …). On failure each `StandardSchemaV1.Issue` becomes a validup `IssueItem`; `path` is normalized so `{ key }`-shape `PathSegment` entries are flattened to `PropertyKey[]`. Vendor-specific fields (zod's `expected`/`received`) are not surfaced — use `@validup/zod` if those matter.
- **@validup/zod**: `createValidator(zod | (ctx) => zod)` calls `safeParseAsync`; on failure converts each `ZodIssue` (`$ZodRawIssue` from `zod/v4/core`) into a validup `IssueItem`, including `expected` / `received`. Also exports `buildZodIssuesForError` for the reverse direction. Choose this over `@validup/standard-schema` when you need vendor-specific issue fields or bidirectional conversion.
- **@validup/validator-js**: ships pre-baked factories per common rule (`isEmail`, `isURL`, `isUUID`, `isLength`, `isInt`, `isFloat`, `isAlpha`, `isAlphanumeric`, `isNumeric`, `isDecimal`, `isIP`, `isMACAddress`, `isDate`, `isISO8601`, `isJSON`, `isBase64`, `isStrongPassword`, `matches`, `equals`). Each accepts a flat options object `BaseFactoryOptions & validator.Is*Options` and stamps the right vocabulary `IssueCode` (+ structured `params`) on failure. `isInt` / `isFloat` / `isLength` split type-failure (`INTEGER` / `DECIMAL` / `MIN_LENGTH`) from range-failure (`MIN_VALUE` / `MAX_VALUE` / `MAX_LENGTH`) on output. The generic `createValidator(fn, { code, message, params? })` wraps any `(value: string, ...args) => boolean` validator.js predicate for the long tail (`isCreditCard`, `isJWT`, …).
- **@validup/vue**: `useValidup(container, state, options?)` is a Vue 3 composable returning a vuelidate-shaped `Composable<T>` (`$invalid`, `$dirty`, `$pending`, `$errors`, per-field `$model`/`$touch`/`$reset`, plus `$crossCuttingErrors` and `$groupErrors`). Options: `group`, `debounce`, `name`, `stopPropagation`, `detached`, `lazy`, `autoDirty`, `scope`. `stopPropagation` skips upward `inject()` only; `detached` skips both `inject()` and `provide()` (invisible to ancestors *and* descendants). Public types are plain type aliases (no `Validup` prefix, no `I` prefix) since no class implements them: `Composable`, `ComposableOptions`, `FieldState`, `Severity`, `ParentRegistry`. `getSeverity(field)` is optional-aware — when every issue on a field carries `meta.optional: true` (stamped by the validup runtime for `optional: true` mounts) it downgrades the result from `'error'` to `'warning'`; any required-mount issue tips the scale back to `'error'`. Layout differs slightly: `module.ts` (composable), `helpers/severity.ts` (`getSeverity`), `helpers/child.ts` (`PARENT_INJECTION_KEY` + `extractResultsFromChild`), `helpers/collector.ts` (private `useCollector`), `types.ts`. No `error.ts` — issues come pre-shaped from the wrapped `Container`.

## Tests

Tests live under each package in `test/` (not a top-level `tests/` dir):

- `packages/validup/test/unit/*.spec.ts` — covers the core (module, group, mount-key, optional, one-of, paths-to-include, error, issue, initialize)
- `packages/validup/test/data/` — shared fixtures (`string-validator.ts`)
- Integration packages each have their own `test/vitest.config.ts` and `test/unit/*.spec.ts`
- `@validup/vue` uses `environment: 'happy-dom'` in its vitest config (the only package that needs a DOM); the others use the default Node env.
