# Concepts Overview

validup's model has three nouns — **Container**, **Validator**, **Issue** — and one verb: `Container.run(data)`. Everything else (groups, optional values, path filtering, oneOf aggregation, run modes) is a knob on top of those three.

## Container

The `Container<T, C>` class is a registry of **mounts**. A mount pairs:

- An optional `path` (string — supports dotted, bracketed, and glob syntax).
- An optional `MountOptions` (`group`, `optional`, `optionalValue`, `optionalInclude`).
- Either a `Validator` function or a nested `IContainer`.

```typescript
const c = new Container<{ name: string; tags: string[] }>();
c.mount('name', isString);
c.mount('tags[*]', isTag); // glob path expansion
c.mount(other);            // mount nested container at root
```

`new Container<T, C>(options?)` accepts `{ oneOf, pathsToInclude, pathsToExclude }`.

## Validator

```typescript
type ValidatorContext<C = unknown> = {
    key: string;            // expanded mount path inside the current container
    path: PropertyKey[];    // global mount path including parent containers
    value: unknown;         // the value to validate
    data: Record<string, any>; // input of the current container
    group?: string;
    context: C;             // caller-supplied context; flows into nested containers unchanged
    signal?: AbortSignal;   // run-level cancellation signal
};

type Validator<C = unknown, Out = unknown> =
    (ctx: ValidatorContext<C>) => Out | Promise<Out>;
```

A `Validator` either returns the (optionally transformed) value or throws. Any thrown `Error` becomes an `IssueItem`; a thrown `ValidupError` contributes its `.issues` re-pathed under the parent. Both generics default to `unknown`, so call sites that don't care about typed context or typed output compile unchanged. The optional second generic `Out` lets the [Builder API](/guide/builder) accumulate per-field types from validators that declare their return type.

## Issue

```typescript
type Issue = IssueItem | IssueGroup;

interface IssueItem {
    type: 'item';
    code: IssueCode | (string & {}); // VALUE_INVALID by default
    path: PropertyKey[];
    message: string;
    received?: unknown;
    expected?: unknown;
    params?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}

interface IssueGroup {
    type: 'group';
    code?: IssueCode | (string & {}); // e.g. ONE_OF_FAILED
    path: PropertyKey[];
    message: string;
    issues: Issue[]; // recursive
    params?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
```

Always construct issues via the factories `defineIssueItem` / `defineIssueGroup` — they set `type` correctly and provide sensible defaults.

## The verb

| Method            | Returns           | Purpose                                                   |
|-------------------|-------------------|-----------------------------------------------------------|
| `run(data, opts)` | `Promise<T>`      | Sequential. Throws `ValidupError` on failure.             |
| `runSync(data, opts)` | `T`           | Synchronous. Throws if any validator returns a Promise.   |
| `runParallel(...)` (opts.parallel: true) | `Promise<T>` | Eagerly kicks off all mounts, awaits via `Promise.allSettled`. |
| `safeRun(data, opts)` | `Promise<Result<T>>` | Discriminated success/failure result.                |
| `safeRunSync(data, opts)` | `Result<T>` | Sync version of `safeRun`.                            |

See [Run Modes](/guide/run-modes) for the trade-offs.

## Where to next

- [Container](/guide/container) — mount semantics, registration order, nested containers.
- [Builder API](/guide/builder) — `defineSchema()`, the opt-in compile-time-typed wrapper around `Container`.
- [Validator](/guide/validator) — context fields, transforms, lazy schemas.
- [Issues & Errors](/guide/issues) — structured failures, `formatIssue`, `flattenIssueItems`.
- [Groups](/guide/groups) — `create` / `update` / custom groups from one container.
- [Optional Values](/guide/optional) — `undefined`, `null`, falsy, and predicate-based skip rules.
- [Path Filtering](/guide/path-filtering) — `pathsToInclude` / `pathsToExclude`.
- [One-Of](/guide/one-of) — branch validation: succeed if any mount passes.
- [Run Modes](/guide/run-modes) — sequential, parallel, sync.
- [Cancellation](/guide/cancellation) — `AbortSignal` propagation.
