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
| Core                           | `packages/validup`            | `validup`                    | `@ebec/core`, `blemish`, `pathtrace`, `smob`, `twinop` | —                                    |
| Standard Schema integration    | `packages/standard-schema`    | `@validup/standard-schema`   | `@standard-schema/spec`, `blemish`  | `validup ^1.0.0`                                |
| Zod integration                | `packages/zod`                | `@validup/zod`               | `blemish`, `pathtrace`              | `validup ^1.0.0`, `zod ^4.0.0`                  |
| validator.js integration       | `packages/validator-js`       | `@validup/validator-js`      | `blemish`, `pathtrace`              | `validup ^1.0.0`, `validator ^13.0.0`           |
| Vue integration                | `packages/vue`                | `@validup/vue`               | `blemish`, `pathtrace`              | `validup ^1.0.0`, `vue ^3.3`                    |

`@validup/zod`, `@validup/validator-js` and `@validup/vue` each declare `pathtrace` as a **direct runtime dependency** — `zod/src/error.ts` uses `getPathValue` for the `invalid_type` → `REQUIRED` probe, `validator-js/src/factories/comparison.ts` for `equals`' sibling-field read, and `vue/src/helpers/projection.ts` uses `getPathValue` / `setPathValue` for form-state traversal. It must stay declared even though the core also depends on it: reaching it transitively through the `validup` peer happens to resolve under npm's hoisting in this workspace, but breaks for consumers on pnpm's strict node-linker or Yarn PnP. **Any integration package that imports something the core happens to depend on must declare it directly.**

`blemish` is declared by **all four** integration packages under the same rule — they import the issue model from it directly rather than through validup's re-export. See [Import from `blemish`, not from validup's re-export](#import-from-blemish-not-from-validups-re-export).

All packages are `"type": "module"` and publish **ESM-only** (`dist/index.mjs` + `dist/index.d.mts`). No CJS output. License: Apache-2.0 across the board (root + every package).

The `docs/` workspace is `private: true` (excluded from `release-please-config.json` and from monoship). It depends on the local `validup` workspace package via `"validup": "*"` so the Hero playground can SSR a real `Container.safeRunSync(...)` against the current core.

The `playground/*` tree holds private demo apps that exercise the published packages end-to-end. The first one — `playground/vite-vue` — is a multi-route Vite + Vue 3 app (routes for basic / groups / nested / async / server-errors / severity) wired to `@validup/vue` and `@validup/zod` via path aliases at the Vite config and tsconfig levels so edits in `packages/**` hot-reload without a rebuild. Like `docs/`, it's `private: true`, excluded from release-please / monoship, and uses `"validup": "*"` workspace links. The playground also pins its `vue` types (via `paths` in `tsconfig.json`) to the root `node_modules/vue` to keep `Ref<>` identity consistent with what `@validup/vue` was typechecked against — the workspace tree resolves multiple `vue` installs (root override + per-package devDeps) and without the alias `MaybeRef<>` type-checks against the wrong copy.

## Dependency Layers

```
standard-schema ──┬──► validup ──► @ebec/core, pathtrace, smob, twinop
zod ──────────────┤
validator-js ─────┤
vue ──────────────┘
        │
        └──────────► blemish   ◄── validup
                     (the issue model — zero deps, no engines floor)
```

**Every package depends on `blemish` directly** — the integration packages do not reach it through `validup`. This is the same rule that already applies to `pathtrace` (see the note under [Packages](#packages)): an undeclared transitive import happens to resolve under npm's hoisting and breaks on pnpm's strict node-linker or Yarn PnP. It is also forward-looking, since validup's re-export is scheduled for removal — see below.

### The issue model lives in [`blemish`](https://github.com/tada5hi/blemish)

`Issue`, `IssueItem`, `IssueGroup`, `IssueCode`, `IssueDataByCode`, `defineIssueItem`, `defineIssueGroup`, the `isIssue*` guards, `flattenIssueItems` / `flattenIssueGroups`, `prefixIssuePath`, `formatIssue` and `interpolate` are **not defined in this repo**. They live in `blemish`, a standalone zero-dependency package, and `packages/validup/src/index.ts` re-exports them wholesale with `export * from 'blemish';`. There is no `src/issue/` directory any more — intra-package code imports these symbols directly from `'blemish'`.

**Why it was extracted** (tada5hi/validup#464): [rapiq](https://github.com/tada5hi/rapiq) had reimplemented the identical model by hand rather than depend on `validup`, because `validup` brings four transitive dependencies and `engines: node >=24`. `blemish` declares neither, so the model can be shared instead of copied — and issue trees compose across libraries because both sides reference the same types rather than agreeing by structural coincidence.

**Consumer compatibility is unchanged and is a maintained invariant.** Every pre-extraction import path still works, type identity is preserved, and the documented `declare module 'validup' { interface IssueDataByCode { … } }` augmentation still merges. That last one depends on `tsdown` emitting a real `export * from "blemish"` in `dist/index.d.mts` rather than inlining the declarations — inlining would break both identity and augmentation silently, so it is **checked on every build** by `packages/validup/scripts/verify-reexport.mjs` (wired in as `build:verify`), not left as a manual step. `test/unit/issue-reexport.spec.ts` pins the runtime half of the same contract.

### Import from `blemish`, not from validup's re-export

**New code — including every package in this repo — imports the model from `'blemish'` directly.** The four integration packages already do, and each declares `blemish` in its own `dependencies`.

The `export * from 'blemish'` line in `packages/validup/src/index.ts` exists **only** for backward compatibility with consumers who imported these symbols from `validup` before the extraction. It is scheduled for removal in **validup v2.0.0** (tracked in #466). Do not add new internal usages that depend on it, and prefer `blemish` in documentation examples aimed at library authors.

Splitting an import is often the right move rather than picking one source: `packages/zod/src/error.ts` takes `IssueCode` / `defineIssueItem` / `isIssueItem` / `Issue` from `blemish` and `hasOwnProperty` / `ValidupError` from `validup`, because those genuinely come from different packages. `packages/vue/src/helpers/projection.ts` went the whole way — it now imports from `blemish` only and no longer references `validup` at all, which is the honest description of a framework-free projection layer that only ever touched the model.

**Where to make a change.** A change to the *shape* of an issue, the `IssueCode` vocabulary, the per-code `data` contract, or any of the pure tree walks belongs in the `blemish` repo, not here. What remains validup-owned: `ValidupError`, the `isValidupError` guard, `createValidupError`, `errorToIssues`, `buildOneOfFailedGroup`, `buildErrorMessageForAttribute(s)` — all of which carry validup semantics or depend on `@ebec/core`'s `BaseError`.

Note this makes `prefixIssuePath` **public API** for the first time; it was previously a private `Container` method. That is deliberate — it is the rule that maintains the absolute-path invariant, so every producer of a nested tree needs it, which is precisely why rapiq had to write its own.

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
| `container/` | `Container` class (`module.ts`), `IContainer`/`Mount`/`MountOptions` types, `isContainer`. `run` / `runSync` are thin drivers over one private generator, `runBody` — see [Architecture → the twin body](architecture.md#the-syncasync-twin-body-runbody); `runParallel` keeps its own scheduling loop but shares every per-key helper. `ValidatorMount` gains a `sideEffect?: boolean` resolved from descriptor at mount time. `ContainerRunOptions` gains `cache?: IResultCache`. `ContainerOptions`/`ContainerRunOptions` gain `pathsStrict?: boolean`; `paths-strict-violation.ts` holds the exported `PathsStrictViolationError` + `isPathsStrictViolation` guard (run-sync's internal violation lives in `run-sync-violation.ts`). `structural-throw.ts` holds the internal `isStructuralThrow(error, signal?)` predicate — the shared "must not be folded into issues" decision consulted by `collectExecutionFailure` and `wrapSafeRunError`; barrel-excluded because it composes the deliberately-private `isRunSyncViolation` |
| `error/`     | `ValidupError` class (`base.ts`) and `isError`/`isValidupError` guards (`check.ts`)         |
| ~~`issue/`~~  | **Removed** — the issue model now lives in the [`blemish`](https://github.com/tada5hi/blemish) package and is re-exported by `src/index.ts`. See [the issue model section](#the-issue-model-lives-in-blemish) above. Don't recreate this directory; import from `'blemish'` |
| `builder/` | `defineSchema()` entry point + `Builder` class (`module.ts`), `IBuilder`/`MountTarget`/`Mounted`/`IsOptional`/`Spread` types (`types.ts`). The opt-in, **compile-time type-accumulating** alternative to `new Container()` — see [Architecture → Builder](architecture.md#builder-packagesvalidupsrcbuilder). Immutable: every method returns a new `Builder`; `build()` replays the accumulated steps onto a real `Container` |
| `validator/` | `ValidatorDescriptor<C, Out>` type, `defineValidator(descriptor)` factory, `isValidatorDescriptor` duck-typed guard. The wrap layer that lets a validator declare per-mount contract metadata (currently `sideEffect`) without mutating the function object |
| `cache/`     | `IResultCache` interface, `ResultCache` class (Map-backed default impl), `ResultCacheSnapshot` / `ResultCacheOutcome` / `ResultCacheEntry` types, `isResultCache` duck-typed guard. Storage-only — equality + skip logic lives in `container/module.ts:resolveCachedOutcome` |
| `helpers/`   | `compose`/`composeOneOf` (`compose.ts` — a 340-line execution engine, the largest module here), `createValidupError`, `errorToIssues` (the shared unknown-throw → `Issue[]` fold — used by compose's two catch sites **and** `Container.wrapSafeRunError`; `collectExecutionFailure` deliberately keeps its own copy, see [Architecture](architecture.md#two-container-fold-sites-two-different-answers)), `buildOneOfFailedGroup`, `buildErrorMessageForAttribute(s)`, `isOptionalValue`, `stringifyPath`, `resolveDefaults`, `resolvePathFilter` |
| `utils/`     | Internal helpers — `isObject`, `hasOwnProperty`. The sync/async twin protocol behind `Container.runBody` (`op` / `runTwinAsync` / `runTwinSync`) comes from the [`twinop`](https://github.com/tada5hi/twinop) package |
| `constants.ts` | `GroupKey.WILDCARD = '*'`, `OptionalValue` enum — 7 members: `UNDEFINED` / `NULL` / `EMPTY_STRING` / `ZERO` / `FALSE` / `NAN` / `FALSY` (the last is the only composite) |
| `types.ts`   | `ObjectLiteral` only. `Validator` / `ValidatorContext` live in `validator/types.ts`         |
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
- **@validup/vue**: `useValidup(container, state, options?)` is a Vue 3 composable returning a vuelidate-shaped `Composable<T>` (`$invalid`, `$dirty`, `$pending`, `$errors`, per-field `$model`/`$touch`/`$reset`, plus `$crossCuttingErrors` and `$groupErrors`). `state` is typed `Partial<T>` (`StateInput<T> = Partial<T> | Ref<Partial<T>>`) and wrapped in `NoInfer<…>` at the call site so a form narrower than the container's entity (`Container<User>` against a `{ name, email }` create form) type-checks without a cast AND `T` stays bound to the container — the narrower form can't pull `T` toward itself / collapse it to `any`. `Composable<T>['fields']` is `FieldsAccessor<T>`: typed keys (`fields.name` → `FieldState<T['name']>`) carry NO `| undefined` from a fallback index signature (strict-mode clean); dotted/bracketed/runtime-computed paths use the `at` method (`fields.at('user.email')`) which returns `FieldState<unknown>`. A field literally named `at` is shadowed by the accessor — documented trade-off. **`FieldsAccessor`'s mapped type is a three-way constraint knot — do not "simplify" it**; see [the FieldsAccessor knot](#the-fieldsaccessor-knot) below. Options: `group`, `debounce`, `name`, `stopPropagation`, `detached`, `lazy`, `autoDirty`, `scope`. `stopPropagation` skips upward `inject()` only; `detached` skips both `inject()` and `provide()` (invisible to ancestors *and* descendants). Parent/child aggregation links through Vue `provide`/`inject`, which resolves from **ancestor components only** — two `useValidup` calls in the same `<script setup>` never link (the playground's NestedForms page uses real `ProfileSection`/`AddressSection` child components for exactly this reason). The collector's child registry is `shallowReactive(new Map())`: `$getResultsForChild(name)` is reactive in templates/`computed`s (tracks register/unregister) while returning the child composable raw — its nested refs are not unwrapped. Public types are plain type aliases (no `Validup` prefix, no `I` prefix) since no class implements them: `Composable`, `ComposableOptions`, `FieldState`, `FieldsAccessor`, `Severity`, `ParentRegistry`. `getSeverity(field)` is optional-aware — when every issue on a field carries `meta.optional: true` (stamped by the validup runtime for `optional: true` mounts) it downgrades the result from `'error'` to `'warning'`; any required-mount issue tips the scale back to `'error'`. Pre-touch (not yet `$dirty`) it returns `'warning'` whenever `$errors` contains a required-mount item and `undefined` otherwise. The pristine-warning case works because **`$errors` filters at the source**: required-mount items surface as soon as validation has run (pre-touch included); optional-mount items stay hidden until `$dirty` flips (rule: `isIssueItemVisible(item, dirty) = dirty || !item.meta?.optional`). Same rule for per-field `FieldState.$errors` and form-level `Composable.$errors`, so consumers using `$errors` directly (vuecs, ilingo, hand-rolled `<input>`) pair correctly with `getSeverity` without flattening `$issues`. Owns one `ResultCache` instance per composable scope (passed to every `safeRun`, cleared on `$reset()` and on container-ref swaps) so per-keystroke runs reuse fresh results for non-side-effect mounts and submit (`$validate()`) only re-invokes validators whose `(value, context, group)` snapshot actually changed. Layout differs slightly: `module.ts` (composable), `helpers/severity.ts` (`getSeverity`), `helpers/child.ts` (`PARENT_INJECTION_KEY` + `extractResultsFromChild`), `helpers/collector.ts` (private `useCollector`), `helpers/projection.ts` (private, framework-free — see below), `types.ts`. No `error.ts` — issues come pre-shaped from the wrapped `Container`.

`helpers/projection.ts` holds the **framework-free projection layer**: everything in it is `(data) => data` and imports nothing from `vue`. Three families — the path codec (`pathKey` / `pathFromKey` / `readNested` / `writeNested`), matching + visibility (`isUnderPath`, `isPrefixDirty`, `isIssueItemVisible`), and issue selection (`flatItemsAtPath`, `visibleItems`, `rawIssuesAtPath`, `visibleFormItems`, `crossCuttingItems`, `visibleGroups`, `pruneExternalAtPath`, `tagExternal`). `module.ts` calls into it from inside `computed`s, which is what keeps Vue's dependency tracking intact — the composable owns every `ref` / `computed` / `watch` / `inject` and the projection module owns none. Like `helpers/collector.ts` it is **not** in `helpers/index.ts` (and therefore not in the public barrel); its spec, `test/unit/projection.spec.ts`, imports it by module path and declares `// @vitest-environment node`, so it is the one suite in this package that runs without `happy-dom` or `@vue/test-utils`.

**Traversal is pathtrace; the string codec is local.** `readNested` / `writeNested` are thin delegations to `getPathValue` / `setPathValue` — `@validup/vue` therefore declares `pathtrace` as a direct dependency (it must: an undeclared import is the bug fixed in 42b3de1 for zod / validator-js). Only `pathKey` / `pathFromKey` remain hand-written, because the module's canonical path form is **pure-dotted** so that `pathKey(issue.path)` and `pathFromKey(fieldKey).join('.')` are directly comparable. `arrayToPath(['tags', 0])` is `'tags[0]'`, and `'tags[0].name'.startsWith('tags.')` is false, which would break ancestor-prefix matching; `pathToArray` additionally keeps non-numeric brackets, so `fields.at('meta[locale]')` would resolve `state.meta['[locale]']`. Retiring those two needs a dotted-output option upstream — the open question at the end of [tada5hi/pathtrace#200](https://github.com/tada5hi/pathtrace/issues/200).

Two behaviours are deliberately kept or accepted at the seam:

- `readNested(obj, [])` returns `obj`, whereas `getPathValue(obj, [])` is `undefined`. `pathFromKey('')` yields an empty segment list, so the wrapper short-circuits to preserve the original contract rather than change it silently.
- `setPathValue` stops **at** an unsafe segment rather than rejecting the path up front, so `['safe', '__proto__', 'x']` leaves `{ safe: {} }` behind where the old hand-rolled version left `{}`. Nothing is written through the unsafe key and `Object.prototype` is never touched; the stricter guarantee was given up so the unsafe-key list lives in one repo instead of two.

**Why the fork existed and why it is gone.** pathtrace ≤ 2.2.2 decided array-vs-object creation from the *current* segment rather than the *next* and refused to replace a `null` intermediate — both fixed in 2.2.3. Keeping a second copy is precisely what let this module drift: its `/^\d+$/` index test lost values for non-canonical keys like `items.01.name` (the same defect pathtrace carried, caught in review there but not here), and the hand-rolled traversal shipped with no unsafe-key guard at all until review found it. **The lesson is in the pattern, not the bug: a forked helper stops receiving upstream fixes and silently accrues its own.**

The one place the local codec deliberately **converges** with pathtrace is the unsafe-key set. `readNested` / `writeNested` refuse to traverse `__proto__` / `constructor` / `prototype` — the same three keys as pathtrace's `isUnsafeKey`, with the same abandon-the-operation semantics rather than a throw (a `$model` setter is not a place a consumer can catch from). Without it, `fields.at('__proto__.polluted').$model.value = x` assigns to `Object.prototype`, so any field key derived from user input, a route param, or a server response is a prototype-pollution vector. **When forking a path helper from pathtrace, port the safety guard even when you deliberately diverge on the traversal semantics.**

Two consequences worth knowing. A form field literally named `constructor` (or `prototype` / `__proto__`) is **not addressable** through `fields.at(...)` — the same class of documented trade-off as a field named `at` being shadowed by the accessor. And because the guard sits inside `writeNested` rather than at the `$model` setter, a rejected write still runs `dirtyPaths.add(path)` / `clearExternalAtPath(path)`: the field reports dirty even though nothing was written. Both are deliberate — narrowing the guard would mean duplicating the key list at every call site — but neither is free.

### The `FieldsAccessor` knot

`FieldsAccessor<T>` in `packages/vue/src/types.ts` is one mapped type serving three constraints that pull against each other. Every one-line spelling tried so far satisfies exactly two, and each of the three has already shipped and been reverted:

| Spelling | Shipped as | #391 no optional marker | #423 widens to `Composable<ObjectLiteral>` | #455 declared keys survive an index signature |
|---|---|---|---|---|
| `K in keyof T as …` | 0.3.3 | ✗ | ✓ | ✓ |
| `K in keyof T as …`**`-?`** | b65e2ce | ✓ | ✗ | ✓ |
| `K in Exclude<keyof T, 'at'>` | 29d0cab (1.0.0) | ✓ | ✓ | ✗ |
| `K in keyof T as …`**`-?`** + `FieldEntry` | current | ✓ | ✓ | ✓ |

The three forces:

1. **#391** — the property must not carry an optional marker (the Proxy materialises a `FieldState` for every key, so it is never `undefined` at runtime). Only `-?` removes it, and `-?` requires a **homomorphic** mapping.
2. **#423** — generic components declare props as `Composable<ObjectLiteral>` (the playground's `ResultPanel.vue`). When `T` widens to `ObjectLiteral` the mapped type collapses to a bare index signature, and every property of the *source* — including the sibling `at` **method** — must then satisfy that index signature's value type. A function is not a `FieldState`.
3. **#455** — entity types commonly carry `[key: string]: any`, which widens `keyof T` to `string | number`. Any mapping keyed off `keyof T` as a *set* therefore collapses to a bare index signature and every declared key loses its type. Only a homomorphic mapping walks declared properties and the index signature separately.

(2) and (3) are what the private `FieldEntry<T, K>` helper resolves: the mapping stays homomorphic (satisfying 1 and 3), and the single catch-all entry an index signature contributes — detected as `string extends K` / `number extends K` — widens to `any`, which the `at` method satisfies. The cost is that keys admitted only by an index signature read as `any` rather than `FieldState<any>`; a `T` without an index signature still rejects unknown keys, so typo detection survives where it exists.

Two traps for anyone touching this:

- **The `Exclude` spelling was never structurally sound.** `FieldsAccessor<Specific>` → `FieldsAccessor<ObjectLiteral>` failed under it; only `Composable<Specific>` → `Composable<ObjectLiteral>` passed, via TypeScript's variance fast path for the surrounding alias. `-?` makes that variance unmeasurable, which is why b65e2ce looked like it *introduced* the widening break. `typing.spec.ts` asserts the bare-accessor widening separately for exactly this reason.
- **Assignability assertions are vacuous here.** The #455 regression degrades a typed key to `FieldState<any>`, which is assignable to `FieldState<string>` in both directions. The spec uses exact-type (`Equals<…>`) assertions.

## Tests

Tests live under each package in `test/` (not a top-level `tests/` dir):

- `packages/validup/test/unit/*.spec.ts` — 30 specs covering the core (module, group, mount-key, mount-dispatch, output-shape, optional, optional-value, path-filter, defaults, one-of, paths-to-include, paths-strict, error, error-to-issues, safe-run-error, pre-dispatch-throw, issue-reexport, format, initialize, define-validator, cache, compose, builder, parallel, run-sync, run-parity, structural-throw, abort-signal, context, typing). The issue model's own behaviour is tested in the [`blemish`](https://github.com/tada5hi/blemish) repo — `issue.spec.ts` and `flatten.spec.ts` moved there and are **not** duplicated here
- `packages/validup/test/data/` — shared fixtures (`string-validator.ts`, exporting both `stringValidator` (async) and `stringValidatorSync`)
- `packages/validup/test/helpers/` — spec helpers, not collected by vitest (`parity.ts` — `expectRunParity` / `expectRunFailureParity`, the `run` ↔ `runSync` twin contract)
- Integration packages each have their own `test/vitest.config.ts` and `test/unit/*.spec.ts`
- `@validup/vue` uses `environment: 'happy-dom'` in its vitest config (the only package that needs a DOM); the others use the default Node env. `test/unit/projection.spec.ts` opts back out with a `// @vitest-environment node` docblock — the projection layer is framework-free, so its spec proves it by running without a DOM.
