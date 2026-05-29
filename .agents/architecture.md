# Architecture

Validup's model has three nouns — **Container**, **Validator**, **Issue** — and one verb: `Container.run(data)` (with `runSync` / `runParallel` / `safeRun` / `safeRunSync` siblings). Integration packages either produce a `Validator` from a foreign validation library (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`) or wire a `Container` into a runtime / framework (`@validup/vue`).

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

`ContainerRunOptions.cache?: IValidationCache` lets the caller opt into per-mount result memoization. The cache stores the *raw* outcome of each non-side-effect validator invocation, keyed by `(mount, expanded-key)`; on a hit it replays the outcome through the surrounding run loop so issues get re-built with the current `keyParts` (the same container mounted under two different parents stays correct).

```ts
export interface IValidationCache {
    get(mount: object, key: string): ValidationCacheEntry | undefined;
    set(mount: object, key: string, entry: ValidationCacheEntry): void;
    delete(mount: object, key?: string): void;
    clear(): void;
}

export type ValidationCacheSnapshot = { value: unknown, context: unknown, group: string | undefined };
export type ValidationCacheOutcome =
    | { ok: true, value: unknown }
    | { ok: false, error: unknown };
export type ValidationCacheEntry = { snapshot: ValidationCacheSnapshot, outcome: ValidationCacheOutcome };

export class ValidationCache implements IValidationCache { /* Map-backed default impl */ }
export function isValidationCache(input: unknown): input is IValidationCache;  // duck-typed
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

The cache is threaded through nested container `.run()` calls so a single `ValidationCache` instance covers an entire container tree. `@validup/vue` creates one per composable scope (cleared on `$reset()` and on container-ref swaps).

### Run-variant integration

- **`run`** — synchronous cache check before `await item.data(ctx)`; on miss, an inner try/catch writes the outcome (success or failure) before re-raising into the outer catch.
- **`runSync`** — same shape, plus the `RunSyncViolationError` carve-out (never cached — structural).
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

For each mounted item, in registration order:

0. **Pre-mount abort check** — `options.signal?.throwIfAborted()` runs before each item so a cancelled run short-circuits without entering the per-mount try/catch.
1. **Group filter** — `isItemGroupIncluded(item, options.group)`. `'*'` always passes; otherwise the item's `group` (string or string[]) must include the active group, or the item must declare no group.
2. **Path expansion** — `expandPath(data, item.path)` from `pathtrace` (returns `['']` if no path was given, meaning "operate on the whole input").
3. **Include/exclude filter** — `pathsToInclude` / `pathsToExclude` (run-time options take precedence over container-level options) via `helpers/path-filter.ts:resolvePathFilter`.
4. **Optional short-circuit** — `item.options.optional` is either a boolean (paired with `optionalValue`) or a predicate `(value) => boolean`; predicate wins when present. If optional, skip; if `optionalInclude` is set, copy the optional value through to output.
5. **Dispatch**:
   - `validator` → `await item.data(ctx)` (or `item.data(ctx)` in `runSync`, which throws if the result is thenable). Writes `output[key]`.
   - `container` → `await item.data.run(value, { group, flat: true, path, pathsToInclude, pathsToExclude, defaults: resolveDefaults(...), context, signal, parallel })`. `runSync` calls `item.data.runSync(...)` (throws `RunSyncViolationError` if the child doesn't implement it). Nested results are merged by `mergePaths(key, childKey)` so dotted paths flatten correctly.
6. **Error capture** (`recordMountError`) — abort errors and `RunSyncViolationError`s rethrow verbatim (carved out of the issue-folding path). Otherwise: `ValidupError` issues are re-pathed (parent key prepended); other `Error`s become a single `IssueItem`. Multiple child issues at one path get wrapped in an `IssueGroup` whose `params: { name }` lets consumers re-render the message with `formatIssue`.
7. **Aggregate** (`finalizeOutput`):
   - `oneOf` containers throw only when **every** branch failed (`errorCount === itemCount`), wrapping all issues in a single `IssueGroup` with `code: ONE_OF_FAILED`.
   - Non-`oneOf` containers throw a `ValidupError` with all collected issues if any failed.
   - `defaults` are filled in for missing/`undefined` keys.
   - When `flat` is false (default), the dotted-key `output` is expanded with `setPathValue` into a nested object before returning.

### Execution variants

- **`run`** (default) — sequential `await` per mount.
- **`runSync`** — same loop without `await`. Validator return values must not be thenable; nested containers must implement `runSync`. Violations throw `RunSyncViolationError` (duck-type guard: `isRunSyncViolation`) and are *not* folded into the issue list.
- **`runParallel`** (selected via `ContainerRunOptions.parallel: true`) — eagerly kicks off every mount's promise, then awaits them with `Promise.allSettled`. Issues are merged in mount-registration order regardless of which validator rejects first. Trade-off: parallel mode reads `value` from the input `data` only, skipping the sequential mode's `hasOwnProperty(output, key)` chain-read for sanitize-then-validate patterns.

All three variants share the private helpers `resolveContainerFilters` / `recordMountError` / `finalizeOutput` / `wrapSafeRunError` / `resolveCachedOutcome` / `writeCachedOutcome` so issue handling and cache consultation stay consistent.

### Optional values (`helpers/optional-value.ts`)

`OptionalValue` enum controls what counts as "optional" when `MountOptions.optional: true`:

- `UNDEFINED` (default) — only `undefined`
- `NULL` — `null` or `undefined`
- `FALSY` — any falsy value

Pass `optional: (value) => boolean` for cases the enum can't express (e.g. drop empty strings but keep `0`).

### Validator composition (`helpers/compose.ts`)

`compose(elements, options?)` builds a single `Validator` from many. Each element is a `ComposeElement<C> = Validator<C> | IContainer<any, any>`; an internal `invokeComposeElement` dispatcher detects via `isContainer` and either calls the validator with the threaded `ctx` or invokes the container's `run(value, { path, group, context, signal })` with the threaded value as input (normalised to `{}` for non-object values, mirroring `Container.run`'s defensive cast for nested containers mounted on a non-object value). Containers participate with the same transform-or-throw contract; their parsed output replaces the threaded value in the all-strategy chain, and a successful container wins the branch in `oneOf` mode.

The strategy is picked via `options.oneOf`, discriminated at the type level so the (`bail` × `oneOf`) combinations that don't make sense are rejected by the compiler:

```ts
type ComposeOptions =
    | { oneOf?: false, bail?: boolean }
    | { oneOf: true };
```

- **`oneOf: false`** (default) — every element must pass. Sequential loop; each stage's defined return replaces the threaded `ctx.value` (a `undefined` return passes through). `bail: true` (default) re-throws the first failure verbatim; `bail: false` collects every failure into one aggregate `ValidupError` and threads through throwing stages so the next branch still runs against the last successful value.
- **`oneOf: true`** — branches run as alternatives in registration order. First defined return wins (with the same pass-through fallback to `ctx.value`); subsequent branches never run. All branches failing throws a `ValidupError` whose first issue is an `IssueGroup` with `code: IssueCode.ONE_OF_FAILED` carrying every branch's failures, each stamped with `params: { branch: index }` so consumers can attribute issues. Aborts via `ctx.signal` re-throw verbatim instead of being folded into branch failures. Empty branch list throws `ONE_OF_FAILED` with an empty inner list — "zero successes" is still zero successes.

`composeOneOf([...])` is sugar for `compose([...], { oneOf: true })`. The any-of path lives in a private `composeAnyOf` helper inside `compose.ts` so the main `compose` body stays focused on the all-strategy chain.

Symmetric with `Container.options.oneOf`, just at the validator level — both share the `IssueCode.ONE_OF_FAILED` group shape so consumers / i18n catalogs only need one branch. Allowing `IContainer` as a compose element completes the symmetry: mount-level oneOf works at the container boundary; compose-level oneOf works wherever a `Validator` is expected, including with nested containers as branches.

**Cycle note.** `helpers/compose.ts` imports `IContainer` (type-only) from `container/types.ts` and `isContainer` from `container/check.ts` directly, not through the `../container` barrel, because the barrel re-exports `container/module.ts` which itself imports from `../helpers`. Hitting the leaf modules avoids the barrel-level cycle.

## Issues & Errors

`packages/validup/src/issue/types.ts` — `Issue = IssueItem | IssueGroup` (discriminated by `type`).

```ts
interface IssueBase {
    path: PropertyKey[],
    message: string,
    params?: Record<string, unknown>,   // narrowed per branch on IssueItem
    meta?: Record<string, unknown>,
}

// IssueItem is a discriminated union over three branches:
type IssueItemTyped = IssueItemCommon & {
    code: ParameterizedIssueCode,       // 'min_length' | 'pattern' | 'strong_password' | …
    params: IssueParamsByCode[code],    // required and typed per `IssueParamsByCode`
};
type IssueItemBare = IssueItemCommon & {
    code: BareIssueCode,                // 'email' | 'required' | 'one_of_failed' | …
    params?: undefined,                 // bare codes have no params
};
type IssueItemRaw = IssueItemCommon & {
    code: string & {},                  // ad-hoc / project-specific codes
    params?: Record<string, unknown>,   // open shape
};
type IssueItem = IssueItemTyped | IssueItemBare | IssueItemRaw;

interface IssueGroup extends IssueBase {
    type: 'group',
    code?: IssueCode | (string & {}),   // e.g. IssueCode.ONE_OF_FAILED
    issues: Issue[],                    // recursive
}
```

- Always construct with the factories `defineIssueItem(...)` / `defineIssueGroup(...)` — they set `type` correctly. Pass `params` so consumer-side `formatIssue(issue, templates?)` can re-render the message in another locale.
- **`defineIssueItem` and `createValidupError` enforce the per-code `params` contract at compile time** via conditional-type signatures (`DefineIssueItemData<C>` / `CreateValidupErrorTail<C>` in `src/issue/define.ts` and `src/helpers/create-error.ts`; the shared `ResolveIssueCode<C>` helper in `src/issue/types.ts` handles the `code: undefined → VALUE_INVALID` default). Passing `IssueCode.MIN_LENGTH` without `params: { min }` is a compile error; passing `IssueCode.STRONG_PASSWORD` with `params: { pointsPerUnique: 5 }` is a compile error (scoring weight, not a documented requirement key); passing `IssueCode.EMAIL` with any `params` is a compile error.
- **Consumer-side narrowing has a known limitation**: `IssueItemRaw`'s `code: string & {}` overlaps with the literal codes, so `if (issue.code === IssueCode.MIN_LENGTH) issue.params.min` types as `number | unknown | undefined` rather than `number`. The producer gatekeep is the primary safety net; consumers needing a clean narrow can use `Extract<IssueItem, { code: 'min_length' }>` or cast after the equality check.
- **`IssueCode`** is the value/type const for the shipped vocabulary (`'value_invalid'`, `'min_length'`, …). **`IssueParamsByCode`** is the `interface` mapping each parameterized code to its `params` shape — open to declaration merging so third-party adapters can augment with their own typed codes (`declare module 'validup' { interface IssueParamsByCode { email_taken: { existingUserId: string } } }`). **`ParameterizedIssueCode` / `BareIssueCode`** are derived from `IssueParamsByCode` + `IssueCode` and feed the conditional-type signatures. Ad-hoc string codes outside the vocabulary fall to `IssueItemRaw` (open `params`).
- **`meta` governance.** `meta` is `Record<string, unknown>` by design — issues cross package boundaries and integration packages / apps need to tag them with provenance core doesn't know about. To keep the bag from sprawling, **library-owned keys must be provenance the consumer cannot reconstruct from `path` + container config.** Presentation tokens (e.g. `severity`) don't qualify and live in consumer code. Reconstructible facts (e.g. the active `group`, which the caller passed) don't qualify either. Apps and third-party validators are free to add their own keys; conflicts are their responsibility.
- **Library-owned `meta` keys** (stable, semver-protected):
  - `optional?: true` — stamped by the runtime when the originating mount's `optional` declaration resolves truthy for the current `value`. Resolution mirrors the run-loop check (boolean → tag iff `true`; predicate → invoke with `value` and tag iff truthy). The predicate is re-evaluated at error time rather than relying on the "predicate already returned false in the run loop" invariant — explicit intent, decoupled from the run path. Reflects only the **most-local** mount, never inherited: a leaf inside an optional child container does NOT carry the flag unless its own mount also evaluated truthy. Wrapping `IssueGroup`s emitted by the optional mount itself DO carry the flag — so a tree walker can distinguish "subtree was optional" from "leaf's own mount was optional." Stamping happens in `container/module.ts` → `recordMountError` (`stampOptional` helper); the "no inheritance" rule is implemented by gating the stamp on `item.type === 'validator'` in the `isValidupError` branch. `recordMountError` takes a single `RecordMountErrorContext` bag (named for `error`, `item`, `value`, `keyParts`, `pathRelative`, `issues`, `signal`) so adding provenance fields is a one-line change at every call site instead of a positional-arg shuffle.
  - `external?: true` — stamped by frameworks injecting server-side issues (e.g. `@validup/vue`'s `setExternalIssues`). Distinguishes server-supplied from validator-supplied so themes can render the distinction.
- `ValidupError` (`error/base.ts`) extends `@ebec/core`'s `BaseError` — it carries `code: 'VALIDUP_ERROR'` (auto-derived from the class name), an optional `cause`, `readonly issues: Issue[]`, and a `toJSON()` overridden to include `issues`. The `.message` is still auto-built from issue paths via `buildErrorMessageForAttributes`.
- `isValidupError(e)` is duck-typed (instanceof OR has a valid `issues` array). Use it across package boundaries — direct `instanceof ValidupError` may miss errors from a duplicate copy of the package. Same pattern for `isRunSyncViolation` (private, internal to `container/`).

## Integration Package Contract

Integration packages come in two shapes:

1. **Validator adapters** (`@validup/standard-schema`, `@validup/zod`, `@validup/validator-js`) — expose factories or a `createValidator()` function that returns a `ValidatorDescriptor<C, Out>`. The schema-style pattern from `@validup/zod`:

```ts
export function createValidator<C, Z extends ZodType>(
    input: Z | ZodCreateFn<C, Z>,
    options: { sideEffect?: boolean } = {},
): ValidatorDescriptor<C, ZodOutput<Z>> {
    return defineValidator<C, ZodOutput<Z>>({
        sideEffect: options.sideEffect,
        run: async (ctx) => {
            const zod = typeof input === 'function' ? input(ctx) : input;
            const outcome = await zod.safeParseAsync(ctx.value);
            if (outcome.success) return outcome.data as ZodOutput<Z>;
            throw new ValidupError(buildIssuesForZodError(outcome.error));
        },
    });
}
```

   Four contract points to preserve when writing or modifying validator adapters:

   - **Accept `T | (ctx: ValidatorContext<C>) => T`** — letting users build per-context validators (e.g. depending on `ctx.data`, `ctx.group`, or `ctx.context`).
   - **Make `createValidator<C>` generic over the validup context type** so the parent `Container<T, C>` keeps `ctx.context` typed end-to-end.
   - **Return a `ValidatorDescriptor<C, Out>`, not a bare `Validator<C, Out>`** — wrap the closure via `defineValidator({ sideEffect, run })`. Accept a `sideEffect?: boolean` option on the public factory so callers can flip it for known-impure schemas (async refines, `superRefine` reading external state); default to undefined (cached). `@validup/validator-js` is a special case — its shipped factories know their own contract (`equals` flips `sideEffect: true` when no `expectedValue` is provided because the comparison target is read from `ctx.data`) and don't surface the option.
   - **Translate foreign errors into `Issue[]`** in a separate `error.ts` module, then throw `new ValidupError(issues)`. Use `defineIssueItem`/`defineIssueGroup` — never construct issue objects literally. (`@validup/standard-schema` is a special case: the spec only exposes `message + path`, so the resulting issues carry only the portable subset.)

2. **Framework / runtime integrations** (`@validup/vue`) — consume a whole `Container<T, C>` and wire it into a host environment.
   - `@validup/vue` exposes a `useValidup<T, C>(container, state, options?)` composable that drives reactive form state from `Container.safeRun()`. Reactive `options.context` re-runs validation on change; an internal `AbortController` per scheduled run cancels the previous when state/group/context updates (and on `onScopeDispose`). `$validate()` deliberately runs *without* a signal so submit-time runs aren't aborted by intervening keystrokes. Issues come pre-shaped from validup, so there is no `error.ts` module here.
   - The composable owns one `ValidationCache` per scope and passes it on every `safeRun` call, so per-keystroke runs reuse fresh results for non-side-effect mounts and submit (`$validate()`) only re-invokes validators whose `(value, context, group)` snapshot actually changed. Cache is cleared on `$reset()` and on container-ref swaps (the watch fires before `schedule()`, so the next run starts cold against the new container's mounts).
