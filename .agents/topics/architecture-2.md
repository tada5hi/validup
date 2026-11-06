## Builder (`packages/validup/src/builder/`)

`defineSchema()` is an **opt-in, compile-time type-accumulating** front-end for `Container`. It is not a second runtime — `build()` materializes a real `Container` and replays every accumulated mount through `Container.mount`, so everything documented above (run variants, groups, optional resolution, cache, `pathsStrict`) applies unchanged.

```ts
const schema = defineSchema()
    .mount('name', isString)                                   // T = { name: string }
    .mount('age', { optional: true }, isNumber)                 // T = { name: string, age?: number }
    .mount('address', defineSchema().mount('city', isString))   // T & { address: { city: string } }
    .pathsStrict();

const container = schema.build();      // Container<{ name: string, age?: number, address: {…} }>
const out = await container.run(data); // statically typed from the mounts
```

**Why it exists.** `new Container<T>()` requires the author to declare `T` up front and keep mounts in sync with it by hand. The builder inverts that: `T` is *derived* from what was registered. Pick per situation:

| Goal | API |
|---|---|
| Static schema, want compile-time exhaustiveness | `defineSchema()` |
| Dynamic mounts (loops, conditional registration, `initialize()` hook) | `new Container<T>()` |
| Ship a domain-scoped reusable validator class | `class extends Container<T>` |

### Type accumulation

The interface lives in `builder/types.ts`. Three type-level pieces do the work:

- **`MountTarget<C>`** = `Validator<C, any> | IBuilder<any, C> | IContainer<any, C>` — the three things mountable under a key.
- **`Mounted<K, V, O>`** resolves the field shape per target kind: a builder or container contributes its own accumulated `U`; a validator contributes `Awaited<Out>` from its return type.
- **`IsOptional<O>`** widens the accumulated key to `{ K?: … }` when `options.optional` is the literal `true` or a predicate — mirroring the runtime fact that an optional mount may be skipped, leaving the key absent. This relies on the `const` modifier on `mount`'s options generic to preserve the literal `true` from inline option objects; a variable typed as plain `boolean` stays required.
- **`Spread<T>`** is cosmetic only — flattens the intersection so editors render `{ foo: string, bar: number }` rather than a chain of `&`.

Re-mounting the same key overrides the previous registration's *type*, matching `Container.mount`'s runtime last-write-wins.

### Immutability + dispatch

Every method (`mount`, `oneOf`, `pathsToInclude`, `pathsToExclude`, `pathsStrict`, and `build`) returns a **new** `Builder` over copied `options` / `steps` — chains may fork without leaking state. Steps are held as a discriminated `Step<C>` union (`{ kind: 'validator' | 'nest' }`) and only replayed at `build()`.

`mount`'s target dispatch has its own ordering constraint, parallel to (but separate from) `Container.mount`'s: a private `isBuilder` guard (duck-typed on `build` + `mount` being functions) is tested **first**, then `isContainer`, then everything else falls through to validator. A nested builder is auto-`.build()`-ed at mount time, so the child is materialized before the parent's `build()` runs.

Note the builder deliberately exposes only the **keyed** `mount` forms — `(key, target)` and `(key, options, target)`. `Container`'s keyless container mount has no builder equivalent, because a keyless mount contributes nothing to the accumulated type.

## Issues & Errors

> **The issue model lives in [`@ebec/core`](https://github.com/tada5hi/ebec)**, a zero-dependency package with no `engines` floor — the same one `ValidupError` takes `BaseError` from. It is **not** re-exported by `packages/validup/src/index.ts`; every module here imports it directly. Everything in this section down to `ValidupError` describes types and functions defined *there* — file paths below are the `ebec` repo's `packages/core/src/issue/`, not this repo's. A change to any of it belongs in that repo. See [structure.md](../structure.md#the-issue-model-lives-in-ebeccore) for why it was extracted and what moving it broke for consumers.
>
> What is still validup's: `ValidupError` (`error/base.ts`), the `isValidupError` guard, `createValidupError`, `errorToIssues`, `buildOneOfFailedGroup`, `buildErrorMessageForAttribute(s)`, and every rule about *when* the runtime emits which issue.

`@ebec/core` (`packages/core/src/issue/types.ts` upstream) — `Issue = IssueItem | IssueGroup` (discriminated by `type`).

```ts
interface IssueBase {
    path: PropertyKey[],
    message: string,
    data?: Record<string, unknown>,   // narrowed per branch on IssueItem
    meta?: Record<string, unknown>,
}

// IssueItem is a discriminated union over three branches:
type IssueItemTyped = IssueItemCommon & {
    code: ParameterizedIssueCode,       // 'min_length' | 'pattern' | 'strong_password' | …
    data: IssueDataByCode[code],    // required and typed per `IssueDataByCode`
};
type IssueItemBare = IssueItemCommon & {
    code: BareIssueCode,                // 'email' | 'required' | 'one_of_failed' | …
    data?: undefined,                 // bare codes have no data
};
type IssueItemRaw = IssueItemCommon & {
    code: string & {},                  // ad-hoc / project-specific codes
    data?: Record<string, unknown>,   // open shape
};
type IssueItem = IssueItemTyped | IssueItemBare | IssueItemRaw;

interface IssueGroup extends IssueBase {
    type: 'group',
    code?: IssueCode | (string & {}),   // e.g. IssueCode.ONE_OF_FAILED
    issues: Issue[],                    // recursive
}
```

- Always construct with the factories `defineIssueItem(...)` / `defineIssueGroup(...)` — they set `type` correctly. Pass `data` so consumer-side `formatIssue(issue, templates?)` can re-render the message in another locale.
- **`defineIssueItem` and `createValidupError` enforce the per-code `data` contract at compile time** via conditional-type signatures (`DefineIssueItemData<C>` in `@ebec/core`'s `issue/define.ts` and `CreateValidupErrorTail<C>` in this repo's `src/helpers/create-error.ts`; the shared `ResolveIssueCode<C>` helper in `@ebec/core`'s `issue/types.ts` handles the `code: undefined → VALUE_INVALID` default). `@validup/validator-js`'s `test:types` covers this **across the package seam** — it is the only automated check in this repo that the gatekeep still enforces after the extraction, so keep it running. Passing `IssueCode.MIN_LENGTH` without `data: { min }` is a compile error; passing `IssueCode.STRONG_PASSWORD` with `data: { pointsPerUnique: 5 }` is a compile error (scoring weight, not a documented requirement key); passing `IssueCode.EMAIL` with any `data` is a compile error.
- **Consumer-side narrowing has a known limitation**: `IssueItemRaw`'s `code: string & {}` overlaps with the literal codes, so `if (issue.code === IssueCode.MIN_LENGTH) issue.data.min` types as `number | unknown | undefined` rather than `number`. The producer gatekeep is the primary safety net; consumers needing a clean narrow can use `Extract<IssueItem, { code: 'min_length' }>` or cast after the equality check.
- **`IssueCode`** is the value/type const for the shipped vocabulary (`'value_invalid'`, `'min_length'`, …). **`IssueDataByCode`** is the `interface` mapping each parameterized code to its `data` shape — open to declaration merging so third-party adapters can augment with their own typed codes. **`ParameterizedIssueCode` / `BareIssueCode`** are derived from `IssueDataByCode` + `IssueCode` and feed the conditional-type signatures. Ad-hoc string codes outside the vocabulary fall to `IssueItemRaw` (open `data`).
- **Augment `'@ebec/core'`, never `'validup'`.** `declare module '@ebec/core' { interface IssueDataByCode { email_taken: { existingUserId: string } } }` merges onto the real interface, and `ParameterizedIssueCode` — computed in that module — picks the new code up. Targeting `'validup'` declares a fresh, unrelated `IssueDataByCode` inside validup's own module scope. That **compiles silently**: no error marks the augmentation as inert, `ParameterizedIssueCode` never sees the code, and `defineIssueItem` / `createValidupError` fall through to the ad-hoc-string branch where `data` is optional and untyped. A stale `'validup'` augmentation is therefore a gatekeep that looks present and does nothing — see [testing.md](testing-reference.md#the-issue-model-is-tested-in-ebec-not-here).
- **`meta` governance.** `meta` is `Record<string, unknown>` by design — issues cross package boundaries and integration packages / apps need to tag them with provenance core doesn't know about. To keep the bag from sprawling, **library-owned keys must be provenance the consumer cannot reconstruct from `path` + container config.** Presentation tokens (e.g. `severity`) don't qualify and live in consumer code. Reconstructible facts (e.g. the active `group`, which the caller passed) don't qualify either. Apps and third-party validators are free to add their own keys; conflicts are their responsibility.
- **Library-owned `meta` keys** (stable, semver-protected):
  - `optional?: true` — stamped by the runtime when the originating mount's `optional` declaration resolves truthy for the current `value`. Resolution mirrors the run-loop check (boolean → tag iff `true`; predicate → invoke with `value` and tag iff truthy). The predicate is re-evaluated at error time rather than relying on the "predicate already returned false in the run loop" invariant — explicit intent, decoupled from the run path. Reflects only the **most-local** mount, never inherited: a leaf inside an optional child container does NOT carry the flag unless its own mount also evaluated truthy. Wrapping `IssueGroup`s emitted by the optional mount itself DO carry the flag — so a tree walker can distinguish "subtree was optional" from "leaf's own mount was optional." Stamping happens in `container/module.ts` → `recordMountError` (`stampOptional` helper); the "no inheritance" rule is implemented by gating the stamp on `item.type === 'validator'` in the `isValidupError` branch. `recordMountError` takes a single `RecordMountErrorContext` bag (named for `error`, `item`, `value`, `keyParts`, `pathRelative`, `issues`, `signal`) so adding provenance fields is a one-line change at every call site instead of a positional-arg shuffle.
  - `external?: true` — stamped by frameworks injecting server-side issues (e.g. `@validup/vue`'s `setExternalIssues`). Distinguishes server-supplied from validator-supplied so themes can render the distinction.
- `ValidupError` (`error/base.ts`) extends `@ebec/core`'s `BaseError` — it carries `code: 'VALIDUP_ERROR'` (auto-derived from the class name), an optional `cause`, `readonly issues: Issue[]`, and a `toJSON()` overridden to include `issues`. The `.message` is still auto-built from issue paths via `buildErrorMessageForAttributes`.
- `isValidupError(e)` checks `instanceof ValidupError`, then the error's `@instanceof` marker chain (`VALIDUP_ERROR_INSTANCE`, via `matchesInstanceof` — covers a duplicate copy of the package and an error rehydrated from `toJSON()` output, since the marker's serialized description string survives a JSON round trip even though the symbol itself doesn't), and only falls back to duck-typing when neither matches: a non-empty `issues` array whose members all pass `isIssue`, or an empty one on an error whose `code` is `'VALIDUP_ERROR'` — `code` survives serialization, so it catches a zero-issue `ValidupError` from before the marker existed (validup <= 2.0.0) that `instanceof`/the marker cannot see. An empty `issues` array with no `VALIDUP_ERROR` code is not sufficient on its own: every `@ebec/core` `BaseError` carries an `issues` array by default. Use `isValidupError` across package boundaries — direct `instanceof ValidupError` may miss errors from a duplicate copy of the package. Same duck-typed-fallback pattern (without a marker) for `isRunSyncViolation` (private, internal to `container/`) and `isPathsStrictViolation` (exported — consumers catch `PathsStrictViolationError` to read the stale `pathsToInclude` / `pathsToExclude`).

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
            throw new ValidupError(buildIssuesForZodError(outcome.error, ctx.value));
        },
    });
}
```

   Four contract points to preserve when writing or modifying validator adapters:

   - **Accept `T | (ctx: ValidatorContext<C>) => T`** — letting users build per-context validators (e.g. depending on `ctx.data`, `ctx.group`, or `ctx.context`).
   - **Make `createValidator<C>` generic over the validup context type** so the parent `Container<T, C>` keeps `ctx.context` typed end-to-end.
   - **Return a `ValidatorDescriptor<C, Out>`, not a bare `Validator<C, Out>`** — wrap the closure via `defineValidator({ sideEffect, run })`. Accept a `sideEffect?: boolean` option on the public factory so callers can flip it for known-impure schemas (async refines, `superRefine` reading external state); default to undefined (cached). `@validup/validator-js` is a special case — its shipped factories know their own contract (`equals` flips `sideEffect: true` when no `expectedValue` is provided because the comparison target is read from `ctx.data`) and don't surface the option.
   - **Translate foreign errors into `Issue[]`** in a separate `error.ts` module, then throw `new ValidupError(issues)`. Use `defineIssueItem`/`defineIssueGroup` — never construct issue objects literally. (`@validup/standard-schema` is a special case: the spec only exposes `message + path`, so the resulting issues carry only the portable subset.) When the foreign library strips structural information the validup vocabulary needs (e.g. zod 4 drops `received` / `input` from the formatted `ZodError`, hiding the missing-key signal needed to emit `REQUIRED`), accept the original input as a second arg on the error-builder and probe it via `getPathValue(input, issue.path)` to recover the signal — `@validup/zod`'s `buildIssuesForZodError(error, input?)` does exactly this. Preserve the single-arg overload (gate the probe on `arguments.length > 1`) so ad-hoc callers without the input keep their existing behavior.

2. **Framework / runtime integrations** (`@validup/vue`) — consume a whole `Container<T, C>` and wire it into a host environment.
   - `@validup/vue` exposes a `useValidup<T, C>(container, state, options?)` composable that drives reactive form state from `Container.safeRun()`. Reactive `options.context` re-runs validation on change; an internal `AbortController` per scheduled run cancels the previous when state/group/context updates (and on `onScopeDispose`). `$validate()` deliberately runs *without* a signal so submit-time runs aren't aborted by intervening keystrokes. Issues come pre-shaped from validup, so there is no `error.ts` module here.
   - The composable owns one `ResultCache` per scope and passes it on every `safeRun` call, so per-keystroke runs reuse fresh results for non-side-effect mounts and submit (`$validate()`) only re-invokes validators whose `(value, context, group)` snapshot actually changed. Cache is cleared on `$reset()` and on container-ref swaps (the watch fires before `schedule()`, so the next run starts cold against the new container's mounts).
