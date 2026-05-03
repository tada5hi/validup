# Architecture

Validup's model has three nouns — **Container**, **Validator**, **Issue** — and one verb: `Container.run(data)` (with `runSync` / `runParallel` / `safeRun` / `safeRunSync` siblings). Integration packages either produce a `Validator` from a foreign validation library (`@validup/standard-schema`, `@validup/zod`, `@validup/express-validator`) or wire a `Container` into a runtime / framework (`@validup/routup`, `@validup/vue`).

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

export type Validator<C = unknown> = (ctx: ValidatorContext<C>) => Promise<unknown> | unknown;
```

A `Validator` either returns the (optionally transformed) value or throws — typically a `ValidupValidatorError`/`ValidupError`, but any `Error` is accepted and gets wrapped into an `IssueItem`. Both generics default to `unknown`, so call sites that don't care about typed context compile unchanged.

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

| Arg type        | Treated as                    |
|-----------------|-------------------------------|
| `string`        | path                          |
| `function`      | `Validator`                   |
| `IContainer`    | nested container (via `isContainer`: object with `run` and `safeRun`) |
| plain object    | `MountOptions`                |

Only a container can be mounted **without a key** — a validator without a path is a `SyntaxError`.

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

All three variants share the private helpers `resolveContainerFilters` / `recordMountError` / `finalizeOutput` / `wrapSafeRunError` so issue handling stays consistent.

### Optional values (`helpers/optional-value.ts`)

`OptionalValue` enum controls what counts as "optional" when `MountOptions.optional: true`:

- `UNDEFINED` (default) — only `undefined`
- `NULL` — `null` or `undefined`
- `FALSY` — any falsy value

Pass `optional: (value) => boolean` for cases the enum can't express (e.g. drop empty strings but keep `0`).

## Issues & Errors

`packages/validup/src/issue/types.ts` — `Issue = IssueItem | IssueGroup` (discriminated by `type`).

```ts
interface IssueBase {
    path: PropertyKey[],
    message: string,
    params?: Record<string, unknown>,   // structured payload for lazy re-rendering
    meta?: Record<string, unknown>,
}

interface IssueItem extends IssueBase {
    type: 'item',
    code: IssueCode | (string & {}),    // IssueCode.VALUE_INVALID by default
    received?: unknown,
    expected?: unknown,
}

interface IssueGroup extends IssueBase {
    type: 'group',
    code?: IssueCode | (string & {}),   // e.g. IssueCode.ONE_OF_FAILED
    issues: Issue[],                    // recursive
}
```

- Always construct with the factories `defineIssueItem(...)` / `defineIssueGroup(...)` — they set `type` correctly. Pass `params` so consumer-side `formatIssue(issue, templates?)` can re-render the message in another locale.
- `IssueCode` is a `const` lookup paired with a declaration-mergeable `IssueCodeRegistry` interface — third parties can add typed codes via module augmentation; the `(string & {})` widening keeps ad-hoc strings working too.
- `ValidupError` (`error/base.ts`) extends `@ebec/core`'s `BaseError` — it carries `code: 'VALIDUP_ERROR'` (auto-derived from the class name), an optional `cause`, `readonly issues: Issue[]`, and a `toJSON()` overridden to include `issues`. The `.message` is still auto-built from issue paths via `buildErrorMessageForAttributes`.
- `isValidupError(e)` is duck-typed (instanceof OR has a valid `issues` array). Use it across package boundaries — direct `instanceof ValidupError` may miss errors from a duplicate copy of the package. Same pattern for `isRunSyncViolation` (private, internal to `container/`).

## Integration Package Contract

Integration packages come in two shapes:

1. **Validator adapters** (`@validup/standard-schema`, `@validup/zod`, `@validup/express-validator`) — expose a function that returns a `Validator<C>`. The pattern from `@validup/zod`:

```ts
export function createValidator<C = unknown>(input: ZodCreateFn<C> | ZodType): Validator<C> {
    return async (ctx): Promise<unknown> => {
        const zod = typeof input === 'function' ? input(ctx) : input;
        const outcome = await zod.safeParseAsync(ctx.value);
        if (outcome.success) return outcome.data;
        throw new ValidupError(buildIssuesForZodError(outcome.error));
    };
}
```

   Three contract points to preserve when writing or modifying validator adapters:

   - **Accept `T | (ctx: ValidatorContext<C>) => T`** — letting users build per-context validators (e.g. depending on `ctx.data`, `ctx.group`, or `ctx.context`).
   - **Make `createValidator<C>` generic over the validup context type** so the parent `Container<T, C>` keeps `ctx.context` typed end-to-end.
   - **Translate foreign errors into `Issue[]`** in a separate `error.ts` module, then throw `new ValidupError(issues)`. Use `defineIssueItem`/`defineIssueGroup` — never construct issue objects literally. (`@validup/standard-schema` is a special case: the spec only exposes `message + path`, so the resulting issues carry only the portable subset.)

2. **Framework / runtime integrations** (`@validup/routup`, `@validup/vue`) — consume a whole `Container<T, C>` and wire it into a host environment.
   - `@validup/routup` wraps a `Container` for HTTP request inputs and tries each `Location` (`body` / `cookies` / `params` / `query`) until one succeeds, throwing the **last** `ValidupError` if all fail. `RoutupContainerRunOptions<T, C>` extends `ContainerRunOptions<T, C>` so `signal`, `context`, and `parallel` flow through automatically.
   - `@validup/vue` exposes a `useValidup<T, C>(container, state, options?)` composable that drives reactive form state from `Container.safeRun()`. Reactive `options.context` re-runs validation on change; an internal `AbortController` per scheduled run cancels the previous when state/group/context updates (and on `onScopeDispose`). `$validate()` deliberately runs *without* a signal so submit-time runs aren't aborted by intervening keystrokes. Issues come pre-shaped from validup, so there is no `error.ts` module here.
