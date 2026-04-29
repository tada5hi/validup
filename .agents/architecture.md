# Architecture

Validup's model has three nouns — **Container**, **Validator**, **Issue** — and one verb: `Container.run(data)`. Adapters are thin functions that produce a `Validator` from a foreign validation library.

## Core Types

`packages/validup/src/types.ts`:

```ts
export type ValidatorContext = {
    key: string,            // expanded mount path inside the current container
    path: PropertyKey[],    // global mount path including parent containers
    value: unknown,         // the value to validate
    data: Record<string, any>, // input of the current container
    group?: string,         // active execution group (if any)
};

export type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;
```

A `Validator` either returns the (optionally transformed) value or throws — typically a `ValidupValidatorError`/`ValidupError`, but any `Error` is accepted and gets wrapped into an `IssueItem`.

## Container

`packages/validup/src/container/module.ts` — the `Container<T>` class.

```ts
const container = new Container<{ foo: string }>();
container.mount('foo', isString);                    // (path, validator)
container.mount('foo', { group: ['create'] }, isString); // (path, options, validator)
container.mount(other);                              // mount nested container at root
container.mount({ group: ['x'] }, other);            // (options, container)

const out = await container.run(data);
const result = await container.safeRun(data);        // Result<T> = success | error
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

### `run()` flow (`module.ts:136`)

For each mounted item, in registration order:

1. **Group filter** — `isItemGroupIncluded(item, options.group)`. `'*'` always passes; otherwise the item's `group` (string or string[]) must include the active group, or the item must declare no group.
2. **Path expansion** — `expandPath(data, item.path)` from `pathtrace` (returns `['']` if no path was given, meaning "operate on the whole input").
3. **Include/exclude filter** — `pathsToInclude` / `pathsToExclude` (run-time options take precedence over container-level options).
4. **Optional short-circuit** — when `item.options.optional` and `isOptionalValue(value, optionalValue)`, skip; if `optionalInclude` is set, copy the optional value through to output.
5. **Dispatch**:
   - `validator` → `await item.data(ctx)`, write to `output[key]`.
   - `container` → `await item.data.run(value, { group, flat: true, path: pathAbsolute, pathsToInclude })`. Nested results are merged by `mergePaths(key, childKey)` so dotted paths flatten correctly.
6. **Error capture** — `ValidupError` issues are re-pathed (parent key prepended); other `Error`s become a single `IssueItem`. Multiple child issues at one path get wrapped in an `IssueGroup`.
7. **Aggregate**:
   - `oneOf` containers throw only when **every** branch failed (`errorCount === itemCount`), wrapping all issues in a single `IssueGroup` with `code: ONE_OF_FAILED`.
   - Non-`oneOf` containers throw a `ValidupError` with all collected issues if any failed.
   - `defaults` are filled in for missing/`undefined` keys.
   - When `flat` is false (default), the dotted-key `output` is expanded with `setPathValue` into a nested object before returning.

### Optional values (`helpers/optional-value.ts`)

`OptionalValue` enum controls what counts as "optional":

- `UNDEFINED` (default) — only `undefined`
- `NULL` — `null` or `undefined`
- `FALSY` — any falsy value

## Issues & Errors

`packages/validup/src/issue/types.ts` — `Issue = IssueItem | IssueGroup` (discriminated by `type`).

```ts
interface IssueItem extends IssueBase {
    type: 'item',
    code: string,            // IssueCode.VALUE_INVALID by default
    received?: unknown,
    expected?: unknown,
}

interface IssueGroup extends IssueBase {
    type: 'group',
    code?: string,           // e.g. IssueCode.ONE_OF_FAILED
    issues: Issue[],         // recursive
}
```

- Always construct with the factories `defineIssueItem(...)` / `defineIssueGroup(...)` — they set `type` correctly.
- `ValidupError` (`error/base.ts`) is `Error` + `readonly issues: Issue[]`. Its `.message` is auto-built from issue paths via `buildErrorMessageForAttributes`.
- `isValidupError(e)` is duck-typed (instanceof OR has a valid `issues` array). Use it across package boundaries — direct `instanceof ValidupError` may miss errors from a duplicate copy of the package.

## Adapter Contract

An adapter exposes a function returning a `Validator`. The pattern from `adapter-zod`:

```ts
export function createValidator(input: ZodCreateFn | ZodType): Validator {
    return async (ctx): Promise<unknown> => {
        const zod = typeof input === 'function' ? input(ctx) : input;
        const outcome = await zod.safeParseAsync(ctx.value);
        if (outcome.success) return outcome.data;
        throw new ValidupError(buildIssuesForZodError(outcome.error));
    };
}
```

Two contract points to preserve when writing or modifying adapters:

1. **Accept `T | (ctx: ValidatorContext) => T`** — letting users build per-context validators (e.g. depending on `ctx.data` or `ctx.group`).
2. **Translate foreign errors into `Issue[]`** in a separate `error.ts` module, then throw `new ValidupError(issues)`. Use `defineIssueItem`/`defineIssueGroup` — never construct issue objects literally.

`adapter-routup` is structurally different: it wraps a `Container` rather than producing a `Validator`. It's the integration point for HTTP request inputs and tries each `Location` (`body` / `cookies` / `params` / `query`) until one succeeds, throwing the **last** `ValidupError` if all fail.
