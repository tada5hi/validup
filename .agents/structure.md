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
├── playground/
│   └── vite-vue/             # Vite + Vue 3 multi-route demo (private, npm: @validup-playground/vite-vue)
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

The `playground/*` tree holds private demo apps that exercise the published packages end-to-end. The first one — `playground/vite-vue` — is a multi-route Vite + Vue 3 app (routes for basic / groups / nested / async / server-errors / severity) wired to `@validup/vue` and `@validup/zod` via path aliases at the Vite config and tsconfig levels so edits in `packages/**` hot-reload without a rebuild. Like `docs/`, it's `private: true`, excluded from release-please / monoship, and uses `"validup": "*"` workspace links. The playground also pins its `vue` types (via `paths` in `tsconfig.json`) to the root `node_modules/vue` to keep `Ref<>` identity consistent with what `@validup/vue` was typechecked against — the workspace tree resolves multiple `vue` installs (root override + per-package devDeps) and without the alias `MaybeRef<>` type-checks against the wrong copy.

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
| `container/` | `Container` class (`module.ts`), `IContainer`/`Mount`/`MountOptions` types, `isContainer`. `ValidatorMount` gains a `sideEffect?: boolean` resolved from descriptor at mount time. `ContainerRunOptions` gains `cache?: IResultCache` |
| `error/`     | `ValidupError` class (`base.ts`) and `isError`/`isValidupError` guards (`check.ts`)         |
| `issue/`     | `Issue` types (item/group), `IssueCode` enum, `defineIssueItem`/`defineIssueGroup` factories, `isIssue`/`isIssueItem`/`isIssueGroup` guards, `flattenIssueItems`/`flattenIssueGroups` |
| `validator/` | `ValidatorDescriptor<C, Out>` type, `defineValidator(descriptor)` factory, `isValidatorDescriptor` duck-typed guard. The wrap layer that lets a validator declare per-mount contract metadata (currently `sideEffect`) without mutating the function object |
| `cache/`     | `IResultCache` interface, `ResultCache` class (Map-backed default impl), `ResultCacheSnapshot` / `ResultCacheOutcome` / `ResultCacheEntry` types, `isResultCache` duck-typed guard. Storage-only — equality + skip logic lives in `container/module.ts:resolveCachedOutcome` |
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

- **@validup/standard-schema**: `createValidator(schema | (ctx) => schema, { sideEffect? })` calls `schema['~standard'].validate(ctx.value)` against any [Standard Schema](https://standardschema.dev) library (zod 3.24+, valibot, arktype, effect-schema, …). Returns a `ValidatorDescriptor<C, InferOutput<S>>`. On failure each `StandardSchemaV1.Issue` becomes a validup `IssueItem`; `path` is normalized so `{ key }`-shape `PathSegment` entries are flattened to `PropertyKey[]`. Vendor-specific fields (zod's `expected`/`received`) are not surfaced — use `@validup/zod` if those matter. Default `sideEffect` unset (cache-eligible); pass `{ sideEffect: true }` for schemas that read external state via async refines.
- **@validup/zod**: `createValidator(zod | (ctx) => zod, { sideEffect? })` calls `safeParseAsync`; on failure converts each `ZodIssue` (`$ZodRawIssue` from `zod/v4/core`) into a validup `IssueItem`, including `expected` / `received`. Each issue's `code` is mapped onto the validup `IssueCode` vocabulary so consumer-side i18n catalogs (e.g. `@ilingo/validup`) hit one parameterized message per code rather than the generic `VALUE_INVALID` fallback: `too_small` / `too_big` split by `origin` into `MIN_LENGTH` / `MAX_LENGTH` (string / array / set / file) vs. `MIN_VALUE` / `MAX_VALUE` (number / bigint / date / int); `invalid_format` switched by `format` into `EMAIL` / `URL` / `UUID` / `PATTERN` (with `{ pattern }`) / `DATE` / `IP_ADDRESS` / `BASE64` / `JSON`; `invalid_value` (enum / literal mismatches) → `ONE_OF_FAILED`; everything else (`custom`, `not_multiple_of`, `unrecognized_keys`, `invalid_union`, …) → `VALUE_INVALID`. `invalid_type` → `REQUIRED` promotion requires the parsed input — zod 4 strips `received` / `input` from the formatted issue, so `module.ts` threads `ctx.value` as the second arg to `buildIssuesForZodError(error, input?)`; `getPathValue(input, issue.path) === undefined` ⇒ `REQUIRED`, otherwise `VALUE_INVALID`. The bare `buildIssuesForZodError(error)` single-arg call sticks on `VALUE_INVALID` (the overload is preserved via an `arguments.length` check so ad-hoc callers don't suddenly get a different code than they did before). Returns a `ValidatorDescriptor<C, ZodOutput<Z>>`. Also exports `buildZodIssuesForError` for the reverse direction. Choose this over `@validup/standard-schema` when you need vendor-specific issue fields or bidirectional conversion. Default `sideEffect` unset (cache-eligible); pass `{ sideEffect: true }` for async refines.
- **@validup/validator-js**: ships pre-baked factories per common rule (`isEmail`, `isURL`, `isUUID`, `isLength`, `isInt`, `isFloat`, `isAlpha`, `isAlphanumeric`, `isNumeric`, `isDecimal`, `isIP`, `isMACAddress`, `isDate`, `isISO8601`, `isJSON`, `isBase64`, `isStrongPassword`, `matches`, `equals`). Each accepts a flat options object `BaseFactoryOptions & validator.Is*Options` and stamps the right vocabulary `IssueCode` (+ structured `data`) on failure. Every factory returns a `ValidatorDescriptor<C>` with `sideEffect` unset (cache-eligible) **except `equals(key, options)`**, which stamps `sideEffect: true` iff `options.expectedValue` is undefined — in that branch the comparison target is read from `getPathValue(ctx.data, key)`, a sibling field the cache snapshot doesn't capture. `isInt` / `isFloat` / `isLength` split type-failure (`INTEGER` / `DECIMAL` / `MIN_LENGTH`) from range-failure (`MIN_VALUE` / `MAX_VALUE` / `MAX_LENGTH`) on output. The generic `createValidator(fn, { code, message, data?, sideEffect? })` wraps any `(value: string, ...args) => boolean` validator.js predicate for the long tail (`isCreditCard`, `isJWT`, …) — also returns a descriptor and surfaces an optional `sideEffect` flag for the unusual case where the wrapped predicate captures external state.
- **@validup/vue**: `useValidup(container, state, options?)` is a Vue 3 composable returning a vuelidate-shaped `Composable<T>` (`$invalid`, `$dirty`, `$pending`, `$errors`, per-field `$model`/`$touch`/`$reset`, plus `$crossCuttingErrors` and `$groupErrors`). `state` is typed `Partial<T>` (`StateInput<T> = Partial<T> | Ref<Partial<T>>`) and wrapped in `NoInfer<…>` at the call site so a form narrower than the container's entity (`Container<User>` against a `{ name, email }` create form) type-checks without a cast AND `T` stays bound to the container — the narrower form can't pull `T` toward itself / collapse it to `any`. `Composable<T>['fields']` is `FieldsAccessor<T>`: typed keys (`fields.name` → `FieldState<T['name']>`) carry NO `| undefined` from a fallback index signature (strict-mode clean); dotted/bracketed/runtime-computed paths use the `at` method (`fields.at('user.email')`) which returns `FieldState<unknown>`. A field literally named `at` is shadowed by the accessor — documented trade-off. Options: `group`, `debounce`, `name`, `stopPropagation`, `detached`, `lazy`, `autoDirty`, `scope`. `stopPropagation` skips upward `inject()` only; `detached` skips both `inject()` and `provide()` (invisible to ancestors *and* descendants). Public types are plain type aliases (no `Validup` prefix, no `I` prefix) since no class implements them: `Composable`, `ComposableOptions`, `FieldState`, `FieldsAccessor`, `Severity`, `ParentRegistry`. `getSeverity(field)` is optional-aware — when every issue on a field carries `meta.optional: true` (stamped by the validup runtime for `optional: true` mounts) it downgrades the result from `'error'` to `'warning'`; any required-mount issue tips the scale back to `'error'`. Pre-touch (not yet `$dirty`) it returns `'warning'` whenever `$errors` contains a required-mount item and `undefined` otherwise. The pristine-warning case works because **`$errors` filters at the source**: required-mount items surface as soon as validation has run (pre-touch included); optional-mount items stay hidden until `$dirty` flips (rule: `isIssueItemVisible(item, dirty) = dirty || !item.meta?.optional`). Same rule for per-field `FieldState.$errors` and form-level `Composable.$errors`, so consumers using `$errors` directly (vuecs, ilingo, hand-rolled `<input>`) pair correctly with `getSeverity` without flattening `$issues`. Owns one `ResultCache` instance per composable scope (passed to every `safeRun`, cleared on `$reset()` and on container-ref swaps) so per-keystroke runs reuse fresh results for non-side-effect mounts and submit (`$validate()`) only re-invokes validators whose `(value, context, group)` snapshot actually changed. Layout differs slightly: `module.ts` (composable), `helpers/severity.ts` (`getSeverity`), `helpers/child.ts` (`PARENT_INJECTION_KEY` + `extractResultsFromChild`), `helpers/collector.ts` (private `useCollector`), `types.ts`. No `error.ts` — issues come pre-shaped from the wrapped `Container`.

## Tests

Tests live under each package in `test/` (not a top-level `tests/` dir):

- `packages/validup/test/unit/*.spec.ts` — covers the core (module, group, mount-key, optional, one-of, paths-to-include, error, issue, initialize, define-validator, cache)
- `packages/validup/test/data/` — shared fixtures (`string-validator.ts`)
- Integration packages each have their own `test/vitest.config.ts` and `test/unit/*.spec.ts`
- `@validup/vue` uses `environment: 'happy-dom'` in its vitest config (the only package that needs a DOM); the others use the default Node env.
