# Architecture

Validup's model has three nouns — **Container**, **Validator**, **Issue** — and one verb: `Container.run(data)` (with `runSync` / `runParallel` / `safeRun` / `safeRunSync` siblings). Integration packages either produce a `Validator` from a foreign validation library (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`) or wire a `Container` into a runtime / framework (`@validup/vue`).

There are **two ways to build a container**: the imperative `new Container<T>()` + `mount(...)` API described below, and the opt-in `defineSchema()` builder that accumulates `T` from the registered mounts (see [Builder](#builder-packagesvalidupsrcbuilder)). The builder is a type-level front-end only — it calls `Container.mount` under the hood, so every runtime behavior documented here applies to both.

## Core Types

`packages/validup/src/types.ts`:

```ts
export type ValidatorContext<C = unknown> = {
    key: string,            // expanded mount path inside the current container
    path: PropertyKey[],    // global mount path including parent containers
    value: unknown,         // the value to validate
    data: Record<string, any>, // input of the current container
    group?: string,         // active execution group (if any)
    context: C,             // caller-supplied context; flows unchanged into nested containers
    signal?: AbortSignal,   // run-level cancellation signal
};

export type Validator<C = unknown, Out = unknown> = (ctx: ValidatorContext<C>) => Out | Promise<Out>;
```

A `Validator` either returns the (optionally transformed) value or throws — typically a `ValidupValidatorError`/`ValidupError`, but any `Error` is accepted and gets wrapped into an `IssueItem`. Both generics default to `unknown`, so call sites that don't care about typed context compile unchanged.

### Validator descriptor (`packages/validup/src/validator/`)

A `ValidatorDescriptor<C, Out>` wraps a `Validator` with metadata the framework consults — currently just `sideEffect`, the per-mount switch for the result cache. Authors return a descriptor instead of a bare function so the runtime can read the declared contract without inspecting closures or mutating function objects.

```ts
export type ValidatorDescriptor<C = unknown, Out = unknown> = {
    sideEffect?: boolean,  // `true` → never cached; default = cached
    run: Validator<C, Out>,
};

export function defineValidator<C, Out>(d: ValidatorDescriptor<C, Out>): ValidatorDescriptor<C, Out>;
export function isValidatorDescriptor(input: unknown): input is ValidatorDescriptor;
```

`mount()` accepts either a bare `Validator<C>` or a `ValidatorDescriptor<C>` (variadic dispatch detects the shape via `isValidatorDescriptor` — duck-typed on `run` function + no `safeRun`, ordered AFTER `isContainer` since a container also exposes `run`). Bare functions normalize to `{ run: fn }` internally; their `sideEffect` is `undefined`, which behaves identically to `false` (cache-eligible). Mark cross-field / async / stateful validators with `defineValidator({ sideEffect: true, run: fn })` so the framework re-runs them every time.

Adapter factories return descriptors with the right `sideEffect` baked in:
- **`@validup/zod`, `@validup/standard-schema`** — `createValidator(schema, { sideEffect?: boolean })`. Default `false` (cached). Set `sideEffect: true` for async refines / `superRefine` reading external state.
- **`@validup/validator-js`** — every shipped factory returns `sideEffect: false` (or omits the flag) **except `equals(key, options)`**, which stamps `sideEffect: true` iff `options.expectedValue` is undefined. In that branch the comparison target comes from `getPathValue(ctx.data, key)` — a sibling field the cache snapshot doesn't capture, so caching would let a `passwordConfirm` mount go stale after `password` changes. The factory making the call is the right authority: it sees its own arguments and can pick the correct contract without the form author needing to know.

### Result cache (`packages/validup/src/cache/`)

`ContainerRunOptions.cache?: IResultCache` lets the caller opt into per-mount result memoization. The cache stores the *raw* outcome of each non-side-effect validator invocation, keyed by `(mount, expanded-key)`; on a hit it replays the outcome through the surrounding run loop so issues get re-built with the current `keyParts` (the same container mounted under two different parents stays correct).

```ts
export interface IResultCache {
    get(mount: object, key: string): ResultCacheEntry | undefined;
    set(mount: object, key: string, entry: ResultCacheEntry): void;
    delete(mount: object, key?: string): void;
    clear(): void;
}

export type ResultCacheSnapshot = { value: unknown, context: unknown, group: string | undefined };
export type ResultCacheOutcome =
    | { ok: true, value: unknown }
    | { ok: false, error: unknown };
export type ResultCacheEntry = { snapshot: ResultCacheSnapshot, outcome: ResultCacheOutcome };

export class ResultCache implements IResultCache { /* Map-backed default impl */ }
export function isResultCache(input: unknown): input is IResultCache;  // duck-typed
```

Hit conditions (all must hold) — checked in `Container.resolveCachedOutcome`:

1. `options.cache` is set.
2. `item.type === 'validator'` (container mounts never cache at the parent level — the cache threads into the child's own `run()` call, where the child's validator mounts handle their own slots).
3. `item.sideEffect !== true`.
4. `cache.get(mount, expandedKey)` returns an entry.
5. `Object.is` matches **all three** of `snapshot.value`, `snapshot.context`, `snapshot.group` against the current invocation.

Write conditions (`Container.writeCachedOutcome`) — same gating PLUS `!options.signal?.aborted` (don't poison the cache with cancellation errors). `RunSyncViolationError`s are also filtered at the call site in `runSync` — they're structural, not validation outcomes.

Storing the *raw outcome* (validator return value OR thrown error) rather than the post-processed `Issue[]` lets the run loop rebuild issues with current `keyParts` on every replay, so a cached child container reused under a different parent path emits correct absolute paths. Replay flow:
- Cache miss → run validator → write `{ ok: true | false, value | error }` → fall through to normal output / issue path.
- Cache hit, `ok: true` → `output[key] = outcome.value`.
- Cache hit, `ok: false` → `throw outcome.error` so the outer `collectExecutionFailure` rebuilds issues with the current run's path / optional context.

The cache is threaded through nested container `.run()` calls so a single `ResultCache` instance covers an entire container tree. `@validup/vue` creates one per composable scope (cleared on `$reset()` and on container-ref swaps).

### Run-variant integration

- **`run` / `runSync`** — one code path (the shared twin body): synchronous cache check before the validator effect; on miss, an inner `try`/`catch` around the `yield*` writes the outcome (success or failure) before re-raising into the outer catch. `RunSyncViolationError`s are carved out of the failure write (never cached — structural).
- **`runParallel`** — cache check happens before each per-mount promise is created. On hit the slot is materialized as `Promise.resolve(value)` / `Promise.reject(error)` so the existing `Promise.allSettled` merge loop handles cached and fresh outcomes identically. Cache writes happen inside the async wrapper that runs the validator, so the entry is persisted before the promise settles.

## Container

`packages/validup/src/container/module.ts` — the `Container<T, C = unknown>` class.

```ts
const container = new Container<{ foo: string }>();
container.mount('foo', isString);                    // (path, validator)
container.mount('foo', { group: ['create'] }, isString); // (path, options, validator)
container.mount(other);                              // mount nested container at root
container.mount({ group: ['x'] }, other);            // (options, container)

const out      = await container.run(data);          // Promise<T>
const result   = await container.safeRun(data);      // Promise<Result<T>>
const outSync  = container.runSync(data);            // T — throws if any validator returns a Promise
const resSync  = container.safeRunSync(data);        // Result<T>
```

**Input type — `Partial<T>`.** `run` / `safeRun` / `runSync` / `safeRunSync` all take `input?: ContainerInput<T>` where `ContainerInput<T> = Partial<T>` (exported alongside the other public types). This reflects the runtime contract — unmounted keys are pass-through, so a form narrower than the validator entity is fine — and matches what `@validup/vue`'s `StateInput<T>` already lets through. Callers handing in a full `T` still satisfy `Partial<T>` (it's the wider type), so no migration on existing code paths. Internal recursion through nested containers also targets `Partial<T>`, which composes cleanly because nested `T` is `any` at the parent-loop call site (`item.data: IContainer<any, any>`).

`ContainerRunOptions.defaults` is similarly partial-by-key (`{ [Key in Path<T>]?: any }`) — supply only the paths you want to backfill instead of having to enumerate every `Path<T>`.

### Mount semantics (`module.ts:62`)

`mount(...args)` is variadic. It detects each arg by type:

| Arg type                                          | Treated as                    |
|---------------------------------------------------|-------------------------------|
| `string`                                          | path                          |
| `function`                                        | `Validator`                   |
| `IContainer`                                      | nested container (via `isContainer`: object with `run` and `safeRun`) |
| `ValidatorDescriptor` (object with `run` fn, no `safeRun`) | validator + metadata (see [Validator descriptor](#validator-descriptor-packagesvalidupsrcvalidator)) |
| plain object                                      | `MountOptions`                |

Only a container can be mounted **without a key** — a validator without a path is a `SyntaxError`. Descriptor detection runs AFTER `isContainer` to disambiguate the two `run`-bearing object shapes.

### `run()` flow

**Strict pre-flight** — before the loop, when `pathsStrict` resolves truthy (`options.pathsStrict ?? this.options.pathsStrict`, run-level wins), `assertPathsStrict` verifies every resolved `pathsToInclude` / `pathsToExclude` entry is satisfied by *this* container (exact expanded-key match, or prefix descent into a container mount — same rules as `resolvePathFilter`). Unmatched entries throw an **exported, structural** `PathsStrictViolationError` (guard `isPathsStrictViolation`) listing the absolute paths. Runs once at the top of `run` (covering the delegated `runParallel`) and `runSync`; the flag threads into **keyed** child `run()` calls beside the stripped filters so nested containers self-check their remainder. Keyless container mounts are a strict blind spot — the parent defers (can't tell a keyless-owned path from a stale one without recursing) and does NOT forward the flag into keyless children (it would false-positive on the parent's own sibling paths). Group filtering is orthogonal (a group-inactive mount still "exists"). Like `RunSyncViolationError`, it's carved out of `collectExecutionFailure` (a nested violation bubbling through the parent's per-mount catch rethrows verbatim) and re-thrown by `wrapSafeRunError` (not folded into a `Result.failure`) — both via the shared `isStructuralThrow` predicate, whose legs and known gaps are documented under [The structural carve-out](#the-structural-carve-out-isstructuralthrow).

For each mounted item, in registration order:

0. **Pre-mount abort check** — `options.signal?.throwIfAborted()` runs before each item so a cancelled run short-circuits without entering the per-mount try/catch.
1. **Group filter** — `isItemGroupIncluded(item, options.group)`. `'*'` always passes; otherwise the item's `group` (string or string[]) must include the active group, or the item must declare no group.
2. **Path expansion** — `expandPath(data, item.path)` from `pathtrace` (returns `['']` if no path was given, meaning "operate on the whole input").
3. **Include/exclude filter** — `pathsToInclude` / `pathsToExclude` (run-time options take precedence over container-level options) via `helpers/path-filter.ts:resolvePathFilter`.

   Steps 2–4 form the **pre-dispatch region**, and all of them touch the caller's input, so all of them can throw on an object that is merely lazy (an ORM entity with a deferred relation, a computed getter, a reactive proxy). Each is inside per-mount error capture: a throw there is attributed to its mount via `describeKey` and folded like a validator failure. Letting one escape discards every issue the earlier mounts collected and replaces the tree with one path-less item — a plausible-looking wrong answer, and under `parallel: true` an unhandled rejection on top. Covered in `test/unit/pre-dispatch-throw.spec.ts` across all three run modes.

   An item-level failure (step 2) is attributed to the **unexpanded** mount path, so a glob mount surfaces as its literal pattern (`items.*.name`) — the keys it would have expanded to are precisely what could not be computed.
4. **Optional short-circuit** — `item.options.optional` is either a boolean (paired with `optionalValue`) or a predicate `(value) => boolean`; predicate wins when present. If optional: write `optionalAs` to output when the option is present on the mount (canonical normalization, presence-not-value), else copy through when `optionalInclude` is set, else omit the key.
5. **Dispatch**:
   - `validator` → `await item.data(ctx)` (or `item.data(ctx)` in `runSync`, which throws if the result is thenable). Writes `output[key]`.
   - `container` → `await item.data.run(value, { group, flat: true, path, pathsToInclude, pathsToExclude, defaults: resolveDefaults(...), context, signal, parallel })`. `runSync` calls `item.data.runSync(...)` (throws `RunSyncViolationError` if the child doesn't implement it). Nested results are merged by `mergePaths(key, childKey)` so dotted paths flatten correctly.
6. **Error capture** (`recordMountError`) — throws that `isStructuralThrow(error, signal)` accepts rethrow verbatim, carved out of the issue-folding path (see [The structural carve-out](#the-structural-carve-out-isstructuralthrow)). Otherwise: `ValidupError` issues are re-pathed (parent key prepended); other `Error`s become a single `IssueItem`. Multiple child issues at one path get wrapped in an `IssueGroup` whose `data: { name }` lets consumers re-render the message with `formatIssue`.
7. **Aggregate** (`finalizeOutput`):
   - `oneOf` containers throw only when **every** branch failed (`errorCount === itemCount`), wrapping all issues in a single `IssueGroup` with `code: ONE_OF_FAILED`.
   - Non-`oneOf` containers throw a `ValidupError` with all collected issues if any failed.
   - `defaults` are filled in for missing/`undefined` keys.
   - When `flat` is false (default), the dotted-key `output` is expanded with `setPathValue` into a nested object before returning.

### Execution variants

- **`run`** (default) — sequential `await` per mount. `runTwinAsync(this.runBody(...))`.
- **`runSync`** — the *same* loop without `await`: `runTwinSync(this.runBody(...))`. Validator return values must not be thenable; nested containers must implement `runSync`. Violations throw `RunSyncViolationError` (duck-type guard: `isRunSyncViolation`) and are *not* folded into the issue list.
- **`runParallel`** (selected via `ContainerRunOptions.parallel: true`) — eagerly kicks off every mount's promise, then awaits them with `Promise.allSettled`. Issues are merged in mount-registration order regardless of which validator rejects first. Trade-off: parallel mode reads `value` from the input `data` only, skipping the sequential mode's `hasOwnProperty(output, key)` chain-read for sanitize-then-validate patterns.

#### The sync/async twin body (`runBody`)

`run` and `runSync` are **not two loops** — they are two drivers over one private generator, `Container.runBody`, using the twin protocol from the [`twinop`](https://github.com/tada5hi/twinop) package. `twinop`'s `TwinOp.async` is `() => T | Promise<T>`, so a `Validator` that is free to be synchronous needs no `Promise.resolve()` wrap.

A twin body yields **effect pairs** — `yield* op(asyncThunk, syncThunk)` — and `runTwinAsync` / `runTwinSync` execute the side they stand for. Effect errors are re-entered via `Generator.throw`, so a `try`/`catch` wrapping a `yield*` site behaves identically in both variants; that is what lets the cache-write and `collectExecutionFailure` blocks exist once. Bodies compose via `yield*` delegation.

`runBody` yields exactly **two** effects — the loop's only impure edges:

| Effect | async thunk | sync thunk |
|---|---|---|
| nested container | `child.run(input, childOptions)` | `child.runSync(...)`, throwing `RunSyncViolationError` when the method is absent |
| validator | `validator(ctx)` | `validator(ctx)`, throwing `RunSyncViolationError` when the return value is thenable (`isThenable`) |

Both structural probes therefore live *inside the sync thunk*, where they belong — the async side cannot produce them. Everything else (abort checks, group filter, path expansion, path filter, optional resolution, cache gating, issue collection, `oneOf` branch wrapping, `finalizeOutput`) exists exactly once.

**`runParallel` deliberately does NOT share the body.** A generator is sequential by construction; expressing "launch every mount, then settle" through it would mean yielding batches *and* giving up the chain-read that distinguishes sequential mode. Instead it shares every per-key helper:

| Helper | Answers |
|---|---|
| `prepareMountKey(item, key, options, pathsToInclude, pathsToExclude)` | `keyParts` / `pathRelative` / `pathAbsolute` / include-exclude verdict (`MountKeyPlan`) |
| `resolveOptionalDirective(item, value, options)` | skip or proceed, and what a skipped key writes (`OptionalDirective`) |
| `buildChildRunOptions(options, key, plan, pathsStrict, parallel?)` | the child-container forward bag — one source of truth for what a nested container inherits |
| `buildValidatorContext(key, plan, value, data, options)` | the `ValidatorContext` handed to a validator |
| `resolveCachedOutcome` / `writeCachedOutcome` | cache gating (see [Result cache](#result-cache-packagesvalidupsrccache)) |

`prepareMountKey` deliberately does **not** read the mount's input `value` — the sequential-vs-parallel value-source asymmetry is a documented behavioural difference, so it stays in the caller and the helper stays pure.

All variants additionally share `resolveContainerFilters` / `resolvePathsStrict` / `assertPathsStrict` / `collectExecutionFailure` / `wrapBranchForOneOf` / `finalizeOutput` / `wrapSafeRunError`, so issue handling and cache consultation stay consistent.

#### The structural carve-out (`isStructuralThrow`)

Not every throw reaching a `catch` is a validation outcome. Three unrelated reasons say "re-raise this verbatim instead of folding it into `Issue[]`", and `container/structural-throw.ts` holds them as one predicate:

```ts
isStructuralThrow(error: unknown, signal?: AbortSignal): boolean
//  = signal?.aborted || isRunSyncViolation(error) || isPathsStrictViolation(error)
```

- **abort** — a *run-state* read, not an error-type test. During an aborted run the in-flight throw is re-raised **as-is**; it is not necessarily `signal.reason` (a validator may throw its own error before the next abort check). This is the contract pinned in `Container.run`'s `@throws` block, so the leg must stay `signal?.aborted` and must never become an `isAbortError(error)` check. Distinct from the four `signal.throwIfAborted()` probes, which proactively throw `signal.reason` between mounts.
- **`RunSyncViolationError`** / **`PathsStrictViolationError`** — structural: the validator graph is wrong, not the input. Both legs go through the duck-typed guards, so a throw from a duplicate package copy or across a realm boundary is still recognised.

Deliberately a plain `boolean`, **not** a type predicate — the abort leg is `true` for arbitrary values, so narrowing to `RunSyncViolationError | PathsStrictViolationError` would be unsound. Barrel-excluded (it composes the private `isRunSyncViolation`); its spec reaches it by module path.

Consulted at the two sites that fold a throw into issues — `collectExecutionFailure` and `wrapSafeRunError` — where all three legs execute the identical `throw`, so leg order is documentation, not semantics.

**The two cache-write sites also use it** — `runBody`'s validator cache-write catch and `runParallel`'s. They previously did not, and diverged: the twin body filtered `isRunSyncViolation` only, `runParallel` filtered nothing inline (both leant on `writeCachedOutcome`'s own `signal?.aborted` gate for the abort leg). A `PathsStrictViolationError` raised by a validator driving its own strict child container was therefore cached and replayed on a later hit, and the two run modes disagreed about it — which matters because a single `ResultCache` is routinely shared across modes (`@validup/vue` holds one per composable scope). Covered by `cache.spec.ts` → "does not cache a PathsStrictViolationError raised by a validator" and "does not cache a structural violation raised by a validator" (the `parallel: true` twin).

These two differ from the fold sites in *how* they use the predicate: they **suppress a side effect** rather than decide a throw (the rethrow sits unconditionally outside the guard). That is why the predicate must stay a plain boolean rather than becoming a throw-helper.

**`helpers/compose.ts`'s two fold sites now use it too**, closing the last gap. They had diverged the same way the cache-write pair had:

| Site | Reached via | Filtered before | Now |
|---|---|---|---|
| `composeAnyOf`'s per-branch catch | `composeOneOf(...)` / `compose(..., { oneOf: true })` | the abort leg alone (`ctx.signal?.aborted`) | full `isStructuralThrow` — a container element's `PathsStrictViolationError` / `RunSyncViolationError` is not buried under `ONE_OF_FAILED` |
| `compose`'s collect-all catch | `compose(..., { bail: false })` | **nothing** — no abort read, neither error-type leg | `bail \|\| isStructuralThrow(...)`; the caller can again tell "misconfigured graph" and "cancelled" from "validation failed" |

The `bail: true` default already re-threw the first failure verbatim, so only the explicit `{ bail: false }` opt-in was ever affected on the second row — which is why the gap survived so long. Both are covered by `compose.spec.ts` → "compose — structural throws are not folded into issues", which pairs each propagation case with an ordinary-failure case so the widening cannot silently swallow real validation issues.

`compose.ts` reaches the predicate through the **leaf** module (`../container/structural-throw`), not the `../container` barrel — the same cycle discipline its `isContainer` import already follows.

With this, every fold site in the codebase consults one predicate. There are no known under-guarded sites left.

**When adding a run or mount option**, thread it through the twin body plus (if a child inherits it) `buildChildRunOptions` — two edits, not six. `runParallel` picks up anything the shared helpers resolve for free; only genuinely scheduling-specific behaviour needs a second touch there.

One behaviour was unified in passing: the "don't cache a `RunSyncViolationError`" guard was previously `runSync`-only and now applies to **both twin drivers** (`run` and `runSync` — one body, one site). It is unreachable on the async side except for the pathological case of a validator letting a `RunSyncViolationError` escape — which `collectExecutionFailure` already rethrows structurally, so not caching it is the consistent reading. It has since been widened to the full `isStructuralThrow` predicate and mirrored into `runParallel` — see [The structural carve-out](#the-structural-carve-out-isstructuralthrow).

**`runParallel` owns every rejection it schedules.** Mount promises are created eagerly and `Promise.allSettled` is only attached after the whole scheduling loop, so any rejection settling in that window — or any throw that escapes the loop before `allSettled` is reached at all — would be unowned, and Node's default `--unhandled-rejections=throw` (this package requires Node >= 24) terminates the process. `Container.ownRejection` attaches a no-op `.catch` at creation and returns the **original** promise, so `allSettled` still observes the real settlement. Every scheduled promise goes through it, including the `Promise.reject(e)` for materializing a pre-dispatch failure as a task. Covered in `parallel.spec.ts` → "should not leak an unhandled rejection when a pre-dispatch read throws".

### Optional values (`helpers/optional-value.ts`)

`OptionalValue` is the atomic vocabulary that controls what counts as "optional" when `MountOptions.optional: true`. Each atom matches **exactly one** runtime value (`FALSY` is the only composite):

- `UNDEFINED` (default) — `value === undefined`
- `NULL` — `value === null` (does NOT include `undefined` — earlier "null or undefined" widening was dropped in favor of the atomic split)
- `EMPTY_STRING` — `value === ''`
- `ZERO` — `value === 0`
- `FALSE` — `value === false`
- `NAN` — `Number.isNaN(value)`
- `FALSY` — composite shortcut for any of the above (`!value`, plus the `NaN` case)

`MountOptions.optionalValue` accepts a single atom or an array — the array form is any-of, so `['undefined', 'null', 'empty_string']` skips on any of those three. An empty array never matches (mount is effectively non-optional). The composite `FALSY` can be mixed with atoms without effect; redundancy is silent.

`optional` is the **gate** (does this mount permit being skipped?); `optionalValue` is the **definition** (which runtime values qualify as "absent"?). The default `UNDEFINED` keeps the core conservative — `0` / `''` / `false` / `null` are real values that reach the validator unless the caller opts in.

Three core layers can supply the definition. **Precedence (highest → lowest):**

1. `MountOptions.optionalValue` / `MountOptions.optionalAs` (per-mount, wins)
2. `ContainerRunOptions.optionalValue` / `ContainerRunOptions.optionalAs` (per-run; forwarded into nested container `run()` calls)
3. `ContainerOptions.optionalValue` / `ContainerOptions.optionalAs` (container-wide, set on `new Container(...)`)
4. Core default (`'undefined'` for `optionalValue`; no `optionalAs`)

Resolution in `Container.run` / `runParallel` / `runSync` is `item.options.optionalValue ?? options.optionalValue ?? this.options.optionalValue` for the gate, and the same fallback chain via `hasOwnProperty` for `optionalAs` (presence — not value — activates the directive, so `{ optionalAs: undefined }` at any layer is a deliberate "emit `undefined`" directive). `optionalAs` and `optionalValue` are forwarded into nested container `run()` calls so the entire sub-tree shares the same defaults unless a child mount overrides. The forward uses `hasOwnProperty` for `optionalAs` so the child sees the layer's intent (emit-undefined vs. not-set) verbatim.

`@validup/vue` adds two additional layers ABOVE the core run-level: `ComposableOptions` (per `useValidup`) and install options (`app.use(createValidup({ optionalValue, optionalAs }))`). The composable resolves `composable ?? install` for both fields and threads the result into `ContainerRunOptions` on every `safeRun` / `$validate()`. No hard-coded form-friendly default — apps that want the empty-string-skip idiom opt in explicitly via install. Per-mount `optionalValue` / `optionalAs` still wins. Use `optional: (value) => boolean` for cases the atom vocabulary can't express.

The matcher lives in `isOptionalValue(value, input)` (`helpers/optional-value.ts`) — single helper, switch over atom kind, array form delegates to a loop over the same matcher. The three `Container` run-loops (`run` / `runParallel` / `runSync`) all consult it the same way; nothing else in the code knows about individual atoms.

### Validator composition (`helpers/compose.ts`)

`compose(elements, options?)` builds a single `Validator` from many. Each element is a `ComposeElement<C> = Validator<C> | IContainer<any, any>`; an internal `invokeComposeElement` dispatcher detects via `isContainer` and either calls the validator with the threaded `ctx` or invokes the container's `run(value, { path, group, context, signal })` with the threaded value as input (normalised to `{}` for non-object values, mirroring `Container.run`'s defensive cast for nested containers mounted on a non-object value). Containers participate with the same transform-or-throw contract; their parsed output replaces the threaded value in the all-strategy chain, and a successful container wins the branch in `oneOf` mode.

The strategy is picked via `options.oneOf`, discriminated at the type level so the (`bail` × `oneOf`) combinations that don't make sense are rejected by the compiler:

```ts
type ComposeOptions =
    | { oneOf?: false, bail?: boolean }
    | { oneOf: true };
```

- **`oneOf: false`** (default) — every element must pass. Sequential loop; each stage's defined return replaces the threaded `ctx.value` (a `undefined` return passes through). `bail: true` (default) re-throws the first failure verbatim; `bail: false` collects every failure into one aggregate `ValidupError` and threads through throwing stages so the next branch still runs against the last successful value.
- **`oneOf: true`** — branches run as alternatives in registration order. First defined return wins (with the same pass-through fallback to `ctx.value`); subsequent branches never run. All branches failing throws a `ValidupError` whose first issue is an `IssueGroup` with `code: IssueCode.ONE_OF_FAILED` carrying every branch's failures, each stamped with `data: { branch: index }` so consumers can attribute issues. Aborts via `ctx.signal` — and structural violations from a container element — re-throw verbatim instead of being folded into branch failures (see [the structural carve-out](#the-structural-carve-out-isstructuralthrow)). Empty branch list throws `ONE_OF_FAILED` with an empty inner list — "zero successes" is still zero successes.

`composeOneOf([...])` is sugar for `compose([...], { oneOf: true })`. The any-of path lives in a private `composeAnyOf` helper inside `compose.ts` so the main `compose` body stays focused on the all-strategy chain.

Symmetric with `Container.options.oneOf`, just at the validator level — both share the `IssueCode.ONE_OF_FAILED` group shape so consumers / i18n catalogs only need one branch. Allowing `IContainer` as a compose element completes the symmetry: mount-level oneOf works at the container boundary; compose-level oneOf works wherever a `Validator` is expected, including with nested containers as branches.

**Cycle note.** `helpers/compose.ts` imports `IContainer` (type-only) from `container/types.ts` and `isContainer` from `container/check.ts` directly, not through the `../container` barrel, because the barrel re-exports `container/module.ts` which itself imports from `../helpers`. Hitting the leaf modules avoids the barrel-level cycle.

**Shared primitives.** Two small helpers carved out of the overlap between compose's catch sites and `Container.finalizeOutput`:

- `errorToIssues(error, { code?, path? })` (`helpers/error-to-issues.ts`) — the defensive `ValidupError` / `Error` / non-`Error` → `Issue[]` fold both helpers needed in identical shape. `ValidupError` issues are spread verbatim (callers map / prefix afterward); `Error` and non-`Error` throws become a single synthetic `IssueItem` with the supplied `code` (defaults to `VALUE_INVALID`) and `path` (defaults to `[]`). The non-`Error` branch has one special case worth knowing: a thrown **non-empty string** becomes the message verbatim; everything else (including the empty string) gets the `Non-Error throw: ` prefix. Used by compose's collect-all catch, `composeAnyOf`'s per-branch wrapper, AND `Container.wrapSafeRunError`.
- `buildOneOfFailedGroup(branchIssues, { path?, message? })` (`helpers/one-of-failed.ts`) — single source of truth for the `IssueCode.ONE_OF_FAILED` wrapping shape. Used by both `composeAnyOf` and `Container.finalizeOutput` so consumers / i18n catalogs only have one variant to format.

#### Two container fold sites, two different answers

`Container` folds a throw into issues at two places, and they resolved the "share or inline?" question differently. The split is deliberate — record it before changing either.

**`wrapSafeRunError` delegates.** It handles a throw that escaped the run loop *entirely* (`safeRun` / `safeRunSync`'s `catch`), so it has no mount to attribute the failure to and applies no transform. After the structural carve-out and an identity passthrough it is one line:

```ts
if (isStructuralThrow(e, options.signal)) throw e;
if (isValidupError(e)) return { success: false, error: e };
return { success: false, error: new ValidupError(errorToIssues(e)) };
```

The delegation reproduces every issue **value** the two hand-written branches produced — `errorToIssues`' defaults (`code: VALUE_INVALID`, `path: []`) already matched, including the verbatim-non-empty-string case. It is **not** byte-identical: `errorToIssues` passes `code` inside the `defineIssueItem` payload instead of letting the factory append it, so the key insertion order became `type, path, code, message` where this site emitted `type, path, message, code`. `toEqual` / `JSON.parse` consumers see nothing; anything string-comparing a serialized `safeRun` failure (golden file, HTTP snapshot, ETag over the body) sees a diff. The change aligns this site with compose's two fold sites and leaves `collectExecutionFailure` — which still builds its synthetic items by hand — as the only site on the old order. Two invariants are load-bearing:

- **The `isValidupError` passthrough must stay a passthrough.** Routing it through `errorToIssues` would spread `issues` into a *fresh* `ValidupError`, dropping the subclass, `cause`, and any custom property. `safeRun` returns the exact object `run` would have thrown.
- **The structural check must stay above both.** `PathsStrictViolationError` / `RunSyncViolationError` / an aborted run re-throw rather than becoming a `Result.failure`. The ordering is only observable for a **`ValidupError` raised during an aborted run** — the one value both guards claim — so that is the case the spec pins (`safe-run-error.spec.ts` → "should re-throw a ValidupError raised during an aborted run"). Swap the two blocks and nothing else in the suite notices.

These branches are **not** defensive-only, but the set of throws reaching them is now deliberately narrow. The per-mount pre-dispatch region (path expansion, key preparation, the value read, the optional gate) sits inside per-mount error capture. A throwing accessor or Proxy trap is folded by `collectExecutionFailure` **with the mount path attached**, preserving earlier issues.

What still reaches `wrapSafeRunError` is a throw with no mount to attribute it to: the **strict pre-flight** (`assertPathsStrict` walks `expandPath(data, item.path)` over every mount before the run loop starts), and `finalizeOutput`'s defaults fill / nested-output expansion. The resulting issue is **path-less**, so `@validup/vue` and friends cannot attribute it to a field: diagnosable, not attributable. That is inherent here — at these sites there is no mount to attribute to — rather than a preserved status quo.

Until `test/unit/safe-run-error.spec.ts` landed, the whole suite stayed green with both branches replaced by a bare re-throw; it now drives them through the strict pre-flight. See [Testing → Reaching `wrapSafeRunError`](../testing.md#reaching-wrapsaferunerror-throw-from-outside-every-per-mount-try).

**`collectExecutionFailure` stays inline.** It handles a throw from one *mounted unit*, and each of its three branches carries a different transform: `prefixIssuePath` (imported from `@ebec/core`; it was a private `Container` method until the extraction) on the spread `ValidupError` issues only, `markOptionalDeep` on the spread branch gated on `item.type === 'validator'`, `markOptional` (shallow) on both synthetic branches with *no* mount-kind gate. Read against `errorToIssues` the *branching* is the same three-way cascade with the same predicates in the same order, and the two synthetic branches build the same message (including the verbatim-non-empty-string case) — they differ only in passing `path: keyParts` instead of `[]`, and in leaving `code` to the factory (see the key-order note above). So the duplication is real but shallow: what is genuinely non-portable is the per-branch transform, not the branching.

It could therefore be routed through `errorToIssues` behind an `isValidupError` short-circuit at the call site. It deliberately is **not**, for two reasons:

- `errorToIssues`' `ValidupError` branch returns a fresh array of the **same issue objects**. The shape is only safe while the call site short-circuits before reaching that branch; anyone later "simplifying" the short-circuit away would have `markOptional` mutate the validator's own `ValidupError.issues[i].meta` — the aliasing leak the comment above `markOptional` exists to prevent, and one that stays invisible until the same error object is replayed from the `ResultCache`.
- The saving is one `else if` cascade, against a hazard that a reviewer has to re-derive each time.

The earlier idea of giving `errorToIssues` a provenance-carrying return (`{ issues, origin }`) so the call site could branch on origin is **rejected**: `errorToIssues` is a public, semver-protected export, and the call site already has `isValidupError` in scope, which answers the same question for free.

One undocumented asymmetry, recorded here so a refactor changes it deliberately rather than by accident: `markOptional` is applied to the two synthetic branches with **no** `item.type` gate, so a *container* mount with `optional: true` whose child throws a plain `Error` stamps `meta.optional: true` on the leaf, while the same mount throwing a `ValidupError` does not (the "no inheritance" gate lives only on the spread branch).

