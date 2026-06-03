# validup 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A composable, path-based validation library for TypeScript.

Mount any validator function (or nested container) onto any path of your input, run them in groups, collect structured issues, and bridge to existing libraries via integration packages. No decorators, no schema DSL, no metadata reflection.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
  - [Validators](#validators)
  - [Containers](#containers)
  - [Issues & Errors](#issues--errors)
- [Builder API (compile-time typing)](#builder-api-compile-time-typing)
- [Mounting](#mounting)
  - [Path Patterns](#path-patterns)
  - [Nested Containers](#nested-containers)
  - [Mounting Without a Path](#mounting-without-a-path)
- [Subclassing](#subclassing)
- [Groups](#groups)
- [Optional Values](#optional-values)
- [oneOf Branches](#oneof-branches)
- [Path Filtering](#path-filtering)
- [Defaults](#defaults)
- [Context](#context)
- [Cancellation](#cancellation)
- [Run Modes](#run-modes)
  - [Parallel Execution](#parallel-execution)
  - [Safe Run](#safe-run)
  - [Sync Fast Path](#sync-fast-path)
- [Localized Messages](#localized-messages)
- [Error Handling](#error-handling)
  - [ValidupError](#validuperror)
  - [Issue Shape](#issue-shape)
  - [Issue Codes](#issue-codes)
- [API Reference](#api-reference)
  - [Container](#container)
  - [defineSchema](#defineschema)
  - [Issue Helpers](#issue-helpers)
  - [Type Guards](#type-guards)
- [Integrations](#integrations)
- [Stability](#stability)
- [License](#license)

## Installation

```bash
npm install validup --save
```

## Quick Start

```typescript
import { Container, ValidupError, type Validator } from 'validup';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }
    return ctx.value;
};

const container = new Container<{ name: string; email: string }>();

container.mount('name', isString);
container.mount('email', isString);

const valid = await container.run({
    name: 'Peter',
    email: 'peter@example.com',
});
// valid is { name: 'Peter', email: 'peter@example.com' }
```

When a validator throws, the container collects the failure into a structured `ValidupError`:

```typescript
try {
    await container.run({ name: 42, email: 'peter@example.com' });
} catch (error) {
    if (error instanceof ValidupError) {
        console.log(error.issues);
        // [{ type: 'item', code: 'value_invalid', path: ['name'], message: '...' }]
    }
}
```

## Key Concepts

### Validators

A validator is a (sync or async) function that receives a `ValidatorContext` and either returns the validated/transformed value or throws.

```typescript
type Validator<C = unknown, Out = unknown> = (ctx: ValidatorContext<C>) => Out | Promise<Out>;

type ValidatorContext<C = unknown> = {
    key: string;            // expanded mount path within the current container
    path: PropertyKey[];    // global mount path including parent containers
    value: unknown;         // the value to validate
    data: Record<string, any>; // input of the current container
    group?: string;         // active execution group, if any
    context: C;             // caller-supplied context (see [Context](#context))
    signal?: AbortSignal;   // cancellation signal (see [Cancellation](#cancellation))
};
```

A validator's **return value** becomes the output for that path — so validators double as transformers/sanitizers. The optional second generic `Out` lets callers (and the [Builder API](#builder-api-compile-time-typing)) infer per-field types from the validator's return type — `Out` defaults to `unknown`, so existing call sites compile unchanged.

#### Descriptor form

`mount()` also accepts a `ValidatorDescriptor<C, Out>` — a small wrapper that attaches per-mount metadata the framework consults. Today the metadata is just `sideEffect`, the switch that opts a validator out of the [result cache](#result-caching).

```typescript
import { defineValidator } from 'validup';

// Cache-eligible (default): same (value, context, group) → reuse result.
const isPositive = defineValidator({
    run: (ctx) => {
        if (typeof ctx.value !== 'number' || ctx.value <= 0) {
            throw new Error('must be positive');
        }
        return ctx.value;
    },
});

// Cross-field / network / stateful — re-run every time:
const isEmailUnique = defineValidator({
    sideEffect: true,
    run: async (ctx) => {
        if (await api.isEmailTaken(ctx.value as string)) {
            throw new Error('Email already taken');
        }
        return ctx.value;
    },
});

container.mount('email', isEmailUnique);
```

Bare functions stay fully supported — `mount('foo', fn)` normalizes them to `{ run: fn }` internally with no behavior change. Use `defineValidator` when you need the metadata.

### Containers

A `Container<T, C>` holds an ordered list of mounts and runs them against an input object. The optional generic `T` constrains mount keys and shapes the resolved output; the optional `C` types the caller-supplied [context](#context).

```typescript
const container = new Container<{ name: string; age: number }>();

container.mount('name', isString);  // ✅ 'name' is a key of T
container.mount('email', isString); // ⚠️ 'email' is not — allowed via fallback type
```

### Issues & Errors

When validation fails, the container throws a `ValidupError` containing a list of `Issue`s. Issues are a discriminated union — each one is either a leaf `IssueItem` or an `IssueGroup` containing children.

```typescript
type Issue = IssueItem | IssueGroup;
```

This recursive structure preserves the path of failure, so consumers can render rich field-level error messages.

## Builder API (compile-time typing)

`new Container<T>()` happily accepts mounts that don't cover every required key of `T`, and `run()` returns `T` regardless. The TypeScript shape is a promise the runtime can't keep:

```typescript
const c = new Container<{ foo: string; bar: number }>();
c.mount('foo', isString);          // ⚠️  bar is never validated
const out = await c.run({});       // out: { foo, bar } — bar is undefined at runtime
```

`defineSchema()` is an opt-in, type-accumulating wrapper around `Container` that derives `T` *from the registered mounts* — so `run()`'s static return type reflects exactly what was registered:

```typescript
import { defineSchema } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

const schema = defineSchema()
    .mount('foo', createValidator(z.string()))                            // { foo: string }
    .mount('age', { optional: true }, createValidator(z.number().int()))  // { foo: string; age?: number }
    .mount('address', defineSchema().mount('city', isString))             // { …; address: { city: string } }
    .build();

const out = await schema.run(input);
// out: { foo: string; age?: number; address: { city: string } } — inferred, not declared
```

The integration packages' `createValidator(...)` functions (`@validup/zod`, `@validup/standard-schema`) infer the per-field `Out` type from the underlying schema, so the builder pulls real types through. Hand-written validators participate too — annotate the return type via `Validator<C, Out>` (or just write the function inline so TypeScript can infer it).

The builder mirrors `Container.mount`'s keyed forms — `.mount(key, target)` and `.mount(key, options, target)` — and dispatches on the target type:

| Target type                        | Effect on `T`                                                           |
|------------------------------------|-------------------------------------------------------------------------|
| `Validator<C, Out>`                | adds `{ [K]: Awaited<Out> }` (or `{ [K]?: Awaited<Out> }` when `options.optional`) |
| `IBuilder<U, C>`                   | adds `{ [K]: U }` and auto-`.build()`s the child                        |
| `IContainer<U, C>` (e.g. `Container<U, C>`) | adds `{ [K]: U }`                                              |

Builders are immutable — every method returns a new instance, so chains can fork without leaking state — and `.build()` materializes a `Container<T, C>`:

```typescript
interface IBuilder<T extends Record<string, any>, C = unknown> {
    mount<K extends string, V extends Validator<C, any> | IBuilder<any, C> | IContainer<any, C>>(
        key: K,
        target: V,
    ): IBuilder<T & Mounted<K, V, undefined>, C>;

    mount<K extends string, const O extends MountOptions, V extends Validator<C, any> | IBuilder<any, C> | IContainer<any, C>>(
        key: K,
        options: O,
        target: V,
    ): IBuilder<T & Mounted<K, V, O>, C>;

    oneOf(): IBuilder<T, C>;
    pathsToInclude(...paths: (keyof T & string)[]): IBuilder<T, C>;
    pathsToExclude(...paths: (keyof T & string)[]): IBuilder<T, C>;
    build(): Container<T, C>;
}
```

> **Note** — the `?`-widening on `optional: true` only fires when TypeScript sees the value as the literal `true` (or a predicate function). The `const` modifier on the second overload preserves literals from inline option objects, so the common case (`mount('email', { optional: true }, ...)`) just works. A pre-typed `MountOptions` variable whose `optional` is `boolean` will keep the field required.

Pass the context type as a generic to flow it through the chain:

```typescript
type AppContext = { userId: string };

const schema = defineSchema<AppContext>()
    .mount('slug', async (ctx) => {
        // ctx.context is typed as AppContext
        await assertSlugAvailable(ctx.value, ctx.context.userId);
        return ctx.value;
    })
    .build();

await schema.run(input, { context: { userId: 'u-42' } });
```

When to reach for which API:

| Goal                                                               | API                                |
|--------------------------------------------------------------------|------------------------------------|
| Static schema, want compile-time exhaustiveness                    | `defineSchema()` builder           |
| Dynamic mounts (loops, conditional registration, `initialize()` hook) | `new Container<T>()`            |
| Ship a domain-scoped, reusable validator class                     | `class extends Container<T>`       |

The imperative `Container` API is **not** deprecated — it remains the runtime substrate (`.build()` calls `Container.mount(...)`) and the right tool whenever the schema isn't fully known up front.

> **Note on `oneOf()`** — only one branch's keys actually appear in the runtime output, but the accumulated type stays as the intersection of every branch (honest about *possible* keys). Wrap the result with your own discriminated union when that fits better.

## Mounting

`container.mount(...)` is variadic. Pass any combination of:

| Argument         | Meaning                          |
|------------------|----------------------------------|
| `string`         | path                             |
| `function`       | `Validator`                      |
| `Container`      | nested container                 |
| plain object     | `MountOptions`                   |

```typescript
container.mount('foo', validator);                              // path + validator
container.mount('foo', { group: 'create' }, validator);          // path + options + validator
container.mount('foo', childContainer);                         // path + nested container
container.mount({ optional: true }, childContainer);            // options + nested container (no path)
container.mount(childContainer);                                // nested container at root
```

### Path Patterns

Paths are resolved via [pathtrace](https://www.npmjs.com/package/pathtrace) and support dot notation, bracket notation, and glob patterns:

```typescript
container.mount('foo.bar', validator);     // nested key
container.mount('foo[1]', validator);      // array index
container.mount('foo.**.bar', validator);  // any depth
container.mount('**.id', validator);       // every `id` anywhere in the tree
```

### Nested Containers

A container can mount another container at any path. The child's results are merged into the parent's output.

```typescript
const address = new Container<{ city: string; country: string }>();
address.mount('city', isString);
address.mount('country', isString);

const user = new Container<{ name: string; address: { city: string; country: string } }>();
user.mount('name', isString);
user.mount('address', address);

const valid = await user.run({
    name: 'Peter',
    address: { city: 'Berlin', country: 'DE' },
});
```

### Mounting Without a Path

A container (but **not** a validator) can be mounted without a path. Its mounts then operate on the parent's input directly — useful for splitting validation rules across multiple files while keeping a flat output shape.

```typescript
const credentials = new Container();
credentials.mount('email', isString);
credentials.mount('password', isString);

const profile = new Container();
profile.mount('name', isString);

const signup = new Container();
signup.mount(credentials);  // no path — flatten into root
signup.mount(profile);
```

## Subclassing

For reusable, self-contained validators it's idiomatic to extend `Container<T>` and register your mounts inside the protected `initialize()` hook. The hook is called by the constructor, so consumers can simply `new RoleValidator()` and run it.

```typescript
import { Container } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

type Role = { name: string; description?: string };

class RoleValidator extends Container<Role> {
    protected override initialize() {
        super.initialize();

        const nameValidator = createValidator(z.string().min(3).max(128));

        // Required on create, optional on update — same validator, different groups.
        this.mount('name', { group: 'create' }, nameValidator);
        this.mount('name', { group: 'update', optional: true }, nameValidator);

        this.mount(
            'description',
            { optional: true },
            createValidator(z.string().max(4096).nullable()),
        );
    }
}

const validator = new RoleValidator();

const onCreate = await validator.run(input, { group: 'create' });
const onUpdate = await validator.run(input, { group: 'update' });
```

This pattern keeps validators close to the entities they validate and makes them easy to share across HTTP layers, queue handlers, and CLI tools.

## Groups

Each mount can opt into one or more **groups**. The `run()` call's `group` option then selects which mounts are executed.

```typescript
const container = new Container<{ id: string; name: string }>();

container.mount('id',   { group: ['update', 'delete'] }, isString);
container.mount('name', { group: ['create', 'update'] }, isString);

await container.run({ id: 'x', name: 'foo' }, { group: 'create' });
// → { name: 'foo' } — `id` is not in the 'create' group

await container.run({ id: 'x', name: 'foo' }, { group: '*' });
// → { id: 'x', name: 'foo' } — wildcard runs everything
```

The wildcard token `'*'` (also exported as `GroupKey.WILDCARD`) bypasses the filter — either as the active group, or to mark a mount as always-run.

## Optional Values

Mark a mount as `optional` to skip it when the input value is "missing". You decide what counts as missing via `optionalValue`:

| `optionalValue`           | Treats as optional                            |
|---------------------------|-----------------------------------------------|
| `'undefined'` (default)   | only `undefined`                              |
| `'null'`                  | `null` and `undefined`                        |
| `'falsy'`                 | any falsy value (`null`, `undefined`, `''`, `0`, `false`) |

```typescript
import { OptionalValue } from 'validup';

container.mount('age',
    { optional: true, optionalValue: OptionalValue.NULL },
    isNumber,
);

await container.run({ age: null });  // ✅ age is skipped
await container.run({});              // ✅ age is skipped
await container.run({ age: 28 });     // ✅ age is validated
```

Set `optionalInclude: true` to copy the optional value through into the output instead of dropping it:

```typescript
container.mount('nickname',
    { optional: true, optionalInclude: true },
    isString,
);

await container.run({});  // → { nickname: undefined }
```

For cases the `optionalValue` enum can't express (e.g. "drop empty string but keep `0`"), pass `optional` as a predicate. Custom predicates win when present and `optionalValue` is ignored:

```typescript
container.mount('name',
    { optional: (v) => v === '' || typeof v === 'undefined' },
    isString,
);

await container.run({ name: '', count: 0 });  // ✅ name skipped, count validated
```

## oneOf Branches

A container created with `{ oneOf: true }` succeeds if **any one** of its mounts succeeds. Failures are aggregated into a single `IssueGroup` (code `one_of_failed`) only when **all** branches fail, and each branch's contribution is wrapped in its own sub-group so consumers can recover per-branch identity.

```typescript
const credential = new Container({ oneOf: true });

credential.mount('email',    createEmailValidator());
credential.mount('username', createUsernameValidator());

await credential.run({ email: 'peter@example.com' });
// → { email: 'peter@example.com' } — username branch failure is ignored

await credential.run({ email: 'not-an-email', username: 'invalid' });
// → throws ValidupError. error.issues is shaped:
// [
//   {
//     type: 'group', code: 'one_of_failed', path: [],
//     issues: [
//       { type: 'group', path: [], data: { branch: 0, name: 'email' },    issues: [...] },
//       { type: 'group', path: [], data: { branch: 1, name: 'username' }, issues: [...] },
//     ],
//   },
// ]
```

The per-branch sub-group's `data.branch` is the mount index (in registration order) and `data.name` is the mount path. Use `flattenIssueItems(error.issues)` for a flat list of leaf failures regardless of branch, or walk the sub-groups when you need to report which branch failed and why.

## Path Filtering

Limit or exclude paths at runtime:

```typescript
await container.run(input, { pathsToInclude: ['name', 'email'] });  // only these
await container.run(input, { pathsToExclude: ['password'] });        // skip these
```

The same options can be set at the container level via `new Container({ pathsToInclude: [...] })`. Run-time options take precedence.

## Defaults

Provide fallback values for keys that end up missing or `undefined` after validation:

```typescript
await container.run({}, {
    defaults: { role: 'user', active: true },
});
// → { role: 'user', active: true }
```

Dotted keys target nested-container output and are sliced through to the matching child:

```typescript
await parent.run({}, {
    defaults: { 'profile.role': 'user' },
});
// → { profile: { role: 'user' } }
```

## Context

Pass request-scoped data (current user, locale, DB connection, request id) to your validators without going through closures or globals. The `context` flows through every nested container unchanged.

```typescript
type AppContext = { userId: string };

const container = new Container<{ slug: string }, AppContext>();

container.mount('slug', async (ctx) => {
    // ctx.context is typed as AppContext
    const exists = await db.slugExists(ctx.value, ctx.context.userId);
    if (exists) {
        throw new Error('Slug already taken');
    }
    return ctx.value;
});

await container.run({ slug: 'my-post' }, { context: { userId: 'u-42' } });
```

The `C` parameter on `Container<T, C>`, `Validator<C>`, and `ValidatorContext<C>` defaults to `unknown`, so existing code without a context type compiles unchanged.

## Cancellation

Pass an `AbortSignal` to abort a run between mounts. The container checks `signal.aborted` before each mount and rethrows `signal.reason`; the signal is also forwarded into `ValidatorContext.signal` so async validators can cancel their own I/O (e.g. `fetch(url, { signal: ctx.signal })`).

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 100);

try {
    await container.run(input, { signal: controller.signal });
} catch (e) {
    // AbortError — not a ValidupError
}
```

`safeRun()` rethrows the abort reason (it is never wrapped into a `Result.failure`) so callers can distinguish "validation failed" from "operation cancelled".

## Result Caching

`Container.run` (and every other run variant) accepts an optional `cache: ResultCache`. When supplied, validator mounts whose `(ctx.value, ctx.context, ctx.group)` snapshot matches a prior invocation are skipped — their cached outcome is replayed instead of re-running the validator. Particularly valuable for forms with slow async validators (network round-trips, regex-heavy schemas): submit-time validation doesn't pay the cost of re-running mounts whose inputs the per-keystroke runs already proved fresh.

```typescript
import { Container, ResultCache, defineValidator } from 'validup';

const container = new Container<{ email: string }>();
let calls = 0;
container.mount('email', defineValidator({
    run: async (ctx) => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 100));
        return ctx.value;
    },
}));

const cache = new ResultCache();
const data = { email: 'peter@example.com' };

await container.run(data, { cache });
await container.run(data, { cache });
// calls === 1 — the second invocation hits the cache
```

**Opt out per validator** with `sideEffect: true` (via `defineValidator` or an adapter's `{ sideEffect: true }` option) for cross-field validators, network calls, or anything else whose result depends on inputs the snapshot doesn't capture. The cache is caller-owned — `Container` never holds a reference, so the lifecycle (per-request / per-form / persistent) is entirely up to you. Implement `IResultCache` directly for LRU eviction, TTL, etc.

See [the Caching guide](https://validup.tada5hi.net/guide/caching) for the full snapshot semantics and lifecycle patterns.

## Run Modes

Four methods — `container.run` / `container.runSync` / `container.safeRun` / `container.safeRunSync` — plus a `parallel` flag on the async ones cover three orthogonal axes: **sync vs async**, **throw vs no-throw `Result`**, and **sequential vs parallel** (async only):

| Need                                              | Call                                          | Returns               |
|---------------------------------------------------|-----------------------------------------------|-----------------------|
| Async, throws on validation failure (default)     | `container.run(input, opts)`                  | `Promise<T>`          |
| Async, throws, parallel mounts                    | `container.run(input, { parallel: true })`    | `Promise<T>`          |
| Async, no-throw `Result`                          | `container.safeRun(input, opts)`              | `Promise<Result<T>>`  |
| Async, no-throw, parallel mounts                  | `container.safeRun(input, { parallel: true })`| `Promise<Result<T>>`  |
| Sync, throws on validation failure                | `container.runSync(input, opts)`              | `T`                   |
| Sync, no-throw `Result`                           | `container.safeRunSync(input, opts)`          | `Result<T>`           |

`sync + parallel` is intentionally not a combination — `Promise.allSettled` is async by definition, and sync graphs don't benefit from concurrency.

**When `safe*` still throws:** the abort reason from `options.signal`, and the structural `RunSyncViolationError` from `safeRunSync` when a validator returns a Promise or a nested container doesn't implement `runSync`. Both bypass the issue-folding path so callers can distinguish them from validation outcomes.

Details on each axis below.

### Parallel Execution

By default mounts run sequentially in registration order. For containers whose mounts hit independent slow async resources (multiple DB lookups, HTTP calls), opt into parallel mode:

```typescript
await container.run(input, { parallel: true });
```

All mounts kick off concurrently and the results merge in registration order — `issues[]` ordering is unchanged. The flag is forwarded into nested containers so the whole tree runs concurrently.

**Trade-off**: in parallel mode each mount captures its `value` from the input `data` *before* any sibling mount runs, so a later mount can no longer read an earlier mount's transformed `output[key]`. Stick with sequential mode (the default) for chained-key sanitize-then-validate patterns.

### Safe Run

`safeRun()` returns a discriminated `Result<T>` instead of throwing — handy when you want to deal with errors without `try/catch`:

```typescript
const result = await container.safeRun(input);

if (result.success) {
    console.log(result.data);   // T
} else {
    console.error(result.error.issues); // ValidupError
}
```

### Sync Fast Path

When every mounted validator (and every nested container's `runSync`) is synchronous, use `runSync()` / `safeRunSync()` to skip the per-mount microtask overhead of `await`:

```typescript
const out = container.runSync(input);  // returns T directly, not Promise<T>
```

`runSync()` throws synchronously if a validator returns a Promise or if a nested container does not implement `runSync` — those are *structural* failures (not validation outcomes), so they're surfaced verbatim and never wrapped into `Result.failure` by `safeRunSync`. Use the async `run()` for any graph that mixes sync and async validators.

## Localized Messages

`Issue.message` is rendered eagerly in English at construction time. For i18n / custom locales, every issue also carries a structured `data?: Record<string, unknown>` field (populated by the runtime where the message references a non-trivial value — e.g. `{ name: 'email' }` on the wrapping group at a failing mount). Pair it with `formatIssue` and a `code → template` map to render at the consumer side:

```typescript
import { formatIssue, type IssueMessageTemplates } from 'validup';

const de: IssueMessageTemplates = {
    value_invalid: 'Feld {name} ist ungültig',
    one_of_failed: 'Keine der Varianten war erfolgreich',
};

for (const issue of error.issues) {
    console.log(formatIssue(issue, de));   // Feld email ist ungültig
}
```

`formatIssue(issue, templates?, fallback?)`:

1. If `templates[issue.code]` exists, returns `interpolate(template, issue.data)` (placeholders use the `{name}` syntax from `@ebec/core`).
2. Otherwise returns `issue.message`.
3. Otherwise returns `fallback`.

Custom validators that want to participate in this flow should pass `data` through `defineIssueItem`/`defineIssueGroup` so consumer-side templates can reference field-specific values. The default `interpolate` is also re-exported for ad-hoc rendering.

## Error Handling

### ValidupError

```typescript
import type { BaseError } from '@ebec/core';

class ValidupError extends BaseError {
    readonly code: string;        // 'VALIDUP_ERROR' (auto-derived from class name)
    readonly issues: Issue[];
    cause?: unknown;              // inherited from BaseError
    toJSON(): { name, message, code, cause?, issues };
}
```

`ValidupError` extends [`@ebec/core`](https://github.com/tada5hi/ebec)'s `BaseError`, so it ships with a `code`, an optional `cause`, and a `toJSON()` for clean transport across HTTP/JSON boundaries. The `message` is auto-built from the failing paths (`Property foo is invalid`, `Properties foo, bar are invalid`).

Subclass `ValidupError` (or `BaseError` directly) when you need a domain-specific code — ebec derives it from the class name automatically.

Use `isValidupError(err)` to check across package boundaries. It is duck-typed (instanceof OR has a valid `issues` array), so it tolerates the case where two copies of `validup` exist in the dependency tree.

```typescript
import { isValidupError } from 'validup';

if (isValidupError(error)) {
    error.issues.forEach((issue) => console.log(issue.path, issue.message));
}
```

### Issue Shape

```typescript
interface IssueItem {
    type: 'item';
    code: string;            // e.g. IssueCode.VALUE_INVALID
    path: PropertyKey[];
    message: string;
    received?: unknown;
    expected?: unknown;
    meta?: Record<string, unknown>;
}

interface IssueGroup {
    type: 'group';
    code?: string;           // e.g. IssueCode.ONE_OF_FAILED
    path: PropertyKey[];
    message: string;
    issues: Issue[];         // recursive
    meta?: Record<string, unknown>;
}
```

Use the factories — they set `type` correctly and apply default codes:

```typescript
import { defineIssueItem, defineIssueGroup, IssueCode } from 'validup';

const item = defineIssueItem({
    path: ['email'],
    message: 'Invalid email',
    expected: 'string (email)',
    received: 42,
});

const group = defineIssueGroup({
    path: ['address'],
    message: 'address is invalid',
    issues: [item],
});
```

### Issue Codes

validup ships a vocabulary of well-known issue codes that adapter packages (`@validup/zod`, `@validup/validator-js`, …) map onto and that i18n catalogs (`@ilingo/validup`) translate from. The vocabulary tracks the common ground across vuelidate, zod, joi, and yup — enough that a translation catalog can ship one localized string per code instead of a generic "invalid value" fallback.

| Theme | Code | When | `data` |
|-------|------|------|----------|
| **Generic / structural** | `VALUE_INVALID` | Default for any `defineIssueItem(...)` without a code | — |
|                          | `ONE_OF_FAILED` | All branches of a `oneOf` container failed (the wrapping group; per-branch sub-groups carry `{ branch, name }`) | — |
| **Presence**             | `REQUIRED` | Value is missing, `undefined`, `null`, or empty | — |
| **Type assertions**      | `ALPHA` | Value contains characters outside the alphabetical set | — |
|                          | `ALPHA_NUM` | Value contains characters outside the alphanumeric set | — |
|                          | `NUMERIC` | Value is not a number | — |
|                          | `INTEGER` | Value is not an integer | — |
|                          | `DECIMAL` | Value is not a decimal number | — |
| **Length** (strings, arrays) | `MIN_LENGTH` | Value is shorter than the configured minimum | `{ min: number }` |
|                              | `MAX_LENGTH` | Value is longer than the configured maximum | `{ max: number }` |
| **Numeric range**        | `MIN_VALUE` | Numeric value is below the configured minimum | `{ min: number }` |
|                          | `MAX_VALUE` | Numeric value is above the configured maximum | `{ max: number }` |
|                          | `BETWEEN` | Numeric value falls outside `[min, max]` | `{ min: number, max: number }` |
| **String format**        | `EMAIL` | Value is not a valid email address | — |
|                          | `URL` | Value is not a valid URL | — |
|                          | `IP_ADDRESS` | Value is not a valid IP address | — |
|                          | `MAC_ADDRESS` | Value is not a valid MAC address | — |
|                          | `UUID` | Value is not a valid UUID | — |
|                          | `DATE` | Value is not a valid / parseable date | — |
|                          | `PATTERN` | Value does not match the expected regex | `{ pattern: string }` |
|                          | `JSON` | Value is not valid JSON | — |
|                          | `BASE64` | Value is not valid base64 | — |
|                          | `STRONG_PASSWORD` | Value doesn't meet the configured strength rules | `{ minLength?, minLowercase?, minUppercase?, minNumbers?, minSymbols? }` |
| **Comparison**           | `SAME_AS` | Value must equal another named field's value (e.g. password-confirm) | `{ other: string }` |

Adapters are responsible for mapping foreign codes onto the vocabulary — e.g. `@validup/zod`'s adapter translates zod's `too_small` (string variant) onto `IssueCode.MIN_LENGTH`. When a foreign code has no direct match, the adapter falls back to `IssueCode.VALUE_INVALID` and the consumer-side template uses the eagerly-rendered English `issue.message`.

The `IssueCode` const exposes the runtime values; the matching `IssueCode` *type* (a derived `typeof IssueCode[keyof typeof IssueCode]`) gives autocomplete on `IssueItem.code`. For project-specific codes — `'email_taken'`, `'rate_limited'` — `IssueItem.code` is widened to `IssueCode | (string & {})` so the literal string is accepted without ceremony:

```typescript
defineIssueItem({ code: 'email_taken', path: ['email'], message: '…' });
// → accepted; downstream code paths treat it like any other code
```

If you want a typed const for your own codes (so `AppCode.EMAIL_TAKEN` autocompletes alongside `AppCode.REQUIRED`), define one alongside the shipped vocabulary:

```typescript
import { IssueCode } from 'validup';

export const AppCode = {
    ...IssueCode,
    EMAIL_TAKEN: 'email_taken',
    RATE_LIMITED: 'rate_limited',
} as const;

export type AppCode = typeof AppCode[keyof typeof AppCode];
```

## API Reference

### Container

```typescript
class Container<
    T extends Record<string, any> = Record<string, any>,
    C = unknown,
> implements IContainer<T, C> {
    constructor(options?: ContainerOptions<T>);

    mount(container: IContainer): void;
    mount(options: MountOptions, container: IContainer): void;
    mount(key: Path<T>, data: IContainer | Validator<C>): void;
    mount(key: Path<T>, options: MountOptions, data: IContainer | Validator<C>): void;

    // `input` is typed `Partial<T>` so a form narrower than the validator's
    // entity type (e.g. a create-form against `Container<User>` where `id` /
    // `createdAt` are server-set) type-checks without a cast.
    run(input?: Partial<T>, options?: ContainerRunOptions<T, C>): Promise<T>;
    safeRun(input?: Partial<T>, options?: ContainerRunOptions<T, C>): Promise<Result<T>>;

    // Sync variants — throw if any validator returns a Promise.
    runSync(input?: Partial<T>, options?: ContainerRunOptions<T, C>): T;
    safeRunSync(input?: Partial<T>, options?: ContainerRunOptions<T, C>): Result<T>;
}
```

| Option                    | Where                  | Description                                                       |
|---------------------------|------------------------|-------------------------------------------------------------------|
| `oneOf`                   | `ContainerOptions`     | Succeed when any mount succeeds                                   |
| `pathsToInclude`          | `ContainerOptions`, `ContainerRunOptions` | Only mount paths in this list are executed     |
| `pathsToExclude`          | `ContainerOptions`, `ContainerRunOptions` | Mount paths in this list are skipped           |
| `defaults`                | `ContainerRunOptions`  | Fallback values for missing/`undefined` keys                      |
| `context`                 | `ContainerRunOptions`  | Caller-supplied value surfaced on `ValidatorContext.context`      |
| `signal`                  | `ContainerRunOptions`  | `AbortSignal` — checked between mounts and forwarded to `ctx.signal` |
| `parallel`                | `ContainerRunOptions`  | Run mounts concurrently (forwarded into nested containers)        |
| `group`                   | `ContainerRunOptions`  | Active group (only matching mounts run; `'*'` runs everything)    |
| `flat`                    | `ContainerRunOptions`  | When `true`, the output is a dotted-key map instead of nested     |
| `path`                    | `ContainerRunOptions`  | Used internally when nesting; rarely set by hand                  |
| `group` (mount)           | `MountOptions`         | Group(s) this mount belongs to (`string \| string[]`)             |
| `optional`                | `MountOptions`         | Skip this mount when value is "optional"                          |
| `optionalValue`           | `MountOptions`         | What counts as optional: `'undefined'` / `'null'` / `'falsy'`     |
| `optionalInclude`         | `MountOptions`         | Copy optional value into the output instead of dropping it        |

### defineSchema

```typescript
function defineSchema<C = unknown>(): IBuilder<{}, C>;
```

See [Builder API](#builder-api-compile-time-typing). Each `.mount(...)` call returns a new builder with the accumulated shape; `.build()` materializes a `Container<T, C>`.

### Issue Helpers

| Export                | Purpose                                              |
|-----------------------|------------------------------------------------------|
| `defineIssueItem`     | Construct an `IssueItem` (sets `type`, default code) |
| `defineIssueGroup`    | Construct an `IssueGroup` (sets `type`)              |
| `createValidupError`  | Build a `ValidupError` carrying one `IssueItem` (sugar for the most common single-issue failure shape). Caller throws. |
| `IssueCode`           | Vocabulary of well-known issue codes (`VALUE_INVALID`, `REQUIRED`, `MIN_LENGTH`, …; full table above) |
| `GroupKey`            | `WILDCARD = '*'`                                     |
| `OptionalValue`       | `UNDEFINED` / `NULL` / `FALSY`                       |

### Validator Composition

```typescript
import { compose, composeOneOf, type ComposeOptions, type ComposeElement } from 'validup';

type ComposeElement<C = unknown> = Validator<C> | IContainer<any, any>;

function compose<C = unknown>(
    elements: ComposeElement<C>[],
    options?: ComposeOptions,
): Validator<C>;

function composeOneOf<C = unknown>(
    elements: ComposeElement<C>[],
): Validator<C>;
```

Build a single `Validator` from many. Each element can be a bare `Validator<C>` function OR a fully-built `IContainer<T, C>` instance — the dispatcher picks the right call shape (containers receive the threaded value as their input, validators receive `ctx`). The strategy is picked via `options.oneOf`:

- **`oneOf: false`** (default) — every element must pass. Stages thread their return value into the next so sanitize-then-validate patterns work; `options.bail` controls fail-fast (`true`, default) vs. collect-all (`false`).
- **`oneOf: true`** — branches run as alternatives in registration order; the first one to succeed wins, subsequent branches are not invoked, and the composed validator returns the winning branch's value. When every branch fails, the composed validator throws a `ValidupError` whose first issue is an `IssueGroup` with `code: IssueCode.ONE_OF_FAILED` carrying every branch's failures (each tagged with `data: { branch }`). `bail` is rejected at the type level under this mode — there's no chain to fail-fast over.

`composeOneOf([...])` is sugar for `compose([...], { oneOf: true })`.

```typescript
// sanitize-then-validate
container.mount('email', compose([trim(), isEmail(), isLength({ max: 254 })]));

// every broken rule surfaces in one pass
container.mount('password', compose([
    isLength({ min: 8 }),
    isAlphanumeric(),
    matches(/[0-9]/),
], { bail: false }));

// accept either an email or a phone number on the same field
container.mount('contact', composeOneOf([isEmail(), isMobilePhone()]));

// any-of with a container branch — accept a string-formatted contact
// OR a nested address object validated by its own container.
container.mount('contact', composeOneOf([
    isEmail(),
    isMobilePhone(),
    addressContainer,
]));
```

Threading notes:
- A stage that returns `undefined` is treated as a pass-through — the upstream value continues down the chain. Validators that DO want to explicitly clear the field must throw or return a sentinel.
- Container elements receive `ctx.value` as their `input` (normalised to `{}` for non-object values, matching how a nested container mounted directly handles a non-object mount value). Their `path` / `group` / `context` / `signal` flow from the threaded `ctx`, so issues from a container branch carry absolute paths from the outer mount (`composeOneOf` mounted at `foo` with a child schema's `street` field surfaces issues at `['foo', 'street']`).

### Type Guards

| Export                | Returns                                              |
|-----------------------|------------------------------------------------------|
| `isValidupError(e)`   | `e is ValidupError` (duck-typed across package copies) |
| `isError(e)`          | `e is Error & {[key: string]: any}`                  |
| `isContainer(x)`      | `x is IContainer` (duck-typed)                       |
| `isIssue(x)`          | `x is Issue`                                         |
| `isIssueItem(x)`      | `x is IssueItem`                                     |
| `isIssueGroup(x)`     | `x is IssueGroup`                                    |

## Integrations

Use one of the official integration packages to bridge an existing validator library, framework, or UI runtime into validup:

| Package                                                                              | Connects                                                                       |
|--------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| [`@validup/standard-schema`](https://npmjs.com/package/@validup/standard-schema)     | Any [Standard Schema](https://standardschema.dev) library — zod 3.24+, valibot, arktype, effect-schema, … |
| [`@validup/zod`](https://npmjs.com/package/@validup/zod)                             | [zod](https://zod.dev) schemas (vendor-specific issue mapping with `expected` / `received`) |
| [`@validup/validator-js`](https://npmjs.com/package/@validup/validator-js)           | [validator.js](https://github.com/validatorjs/validator.js) string validators — pre-baked factories per common rule, plus a generic `createValidator(fn, {...})` for the long tail |
| [`@validup/vue`](https://npmjs.com/package/@validup/vue)                             | [Vue 3](https://vuejs.org) composable for reactive client-side form state      |

## Stability

What's covered by semver:

- **Public exports** — everything re-exported from `validup`'s entry barrel (`Container`, `defineSchema`, `ValidupError`, `Issue` / factories / guards, `IssueCode`, `GroupKey`, `OptionalValue`, helpers in `formatIssue` / `flattenIssue*`).
- **`Container` runtime contract** — `run` / `runSync` / `runParallel` (via `parallel: true`) / `safeRun` / `safeRunSync`, including their throw-contracts as documented on `IContainer` (`safeRun` throws only on abort).
- **`Issue` and `ValidupError` shape** — the discriminated union (`type: 'item' | 'group'`), `data`, `meta`, `code` widening to `IssueCode | (string & {})`.
- **Mount API** — variadic `mount(...)` argument forms listed in [Mounting](#mounting).
- **`oneOf` aggregation shape** — `IssueCode.ONE_OF_FAILED` group wrapping per-branch sub-groups (see [oneOf Branches](#oneof-branches)).

Extension points:

- **`IssueCode` widening** — `IssueItem.code` accepts any `string & {}` so consumers can use project-specific codes without ceremony. Define your own const that spreads `IssueCode` for typed autocomplete on your codes (see [Issue Codes](#issue-codes)).
- **`Validator<C, Out>`** — `C` (context) and `Out` (return type) generics participate in builder inference; defaults stay `unknown`.
- **`IContainer`** — opt-in interface; integration packages can implement it to be mountable as a nested container.
- **`isContainer` / `isValidupError`** — duck-typed guards that tolerate package duplicates and cross-realm throws. Prefer these over `instanceof` at boundaries.

Internal (no semver guarantee):

- Anything not re-exported from `src/index.ts`, including private helpers (`recordMountError`, `finalizeOutput`, etc.) and the `RunSyncViolationError` class.
- Default English `Issue.message` strings — re-render via `formatIssue` and a `code → template` map if you depend on specific wording.

Deprecation policy: a removal lands in at least one minor release as a deprecation (JSDoc `@deprecated` + console warning where feasible) before the next major drops it.

## License

Made with 💚

Published under [Apache 2.0 License](./LICENSE).

[npm-version-src]: https://badge.fury.io/js/validup.svg
[npm-version-href]: https://npmjs.com/package/validup
[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org
