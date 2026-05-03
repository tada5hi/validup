# Container

`Container<T, C>` is the central type. It holds a list of mounts and exposes the `run` / `runSync` / `runParallel` / `safeRun` / `safeRunSync` methods.

::: tip Looking for compile-time-typed schemas?
[`defineSchema()`](/guide/builder) is an opt-in, type-accumulating wrapper around `Container` that derives `T` from the registered mounts — useful when the schema is fully static. The imperative `Container` API on this page remains the right tool when mounts depend on runtime conditions.
:::

## Construction

```typescript
import { Container } from 'validup';

const c = new Container<{ name: string; email: string }>(/* options? */);
```

`ContainerOptions<T>` accepts:

| Option            | Type            | Purpose                                                                                  |
|-------------------|-----------------|------------------------------------------------------------------------------------------|
| `oneOf`           | `boolean`       | Treat the container as a branch: succeed if **any** mount passes; fail only when **all** fail. See [One-Of](/guide/one-of). |
| `pathsToInclude`  | `string[]`      | Only run mounts whose expanded path is included.                                         |
| `pathsToExclude`  | `string[]`      | Skip mounts whose expanded path matches.                                                 |

The second generic, `C`, is the type of `ctx.context` — the caller-supplied context that flows unchanged into every nested container's mounts.

## `mount(...)`

`mount` is variadic. It detects each argument by type:

| Arg type        | Treated as                                           |
|-----------------|------------------------------------------------------|
| `string`        | mount path                                           |
| `function`      | `Validator`                                          |
| `IContainer`    | nested container (object with `run` and `safeRun`)   |
| plain object    | `MountOptions`                                       |

```typescript
container.mount('foo', isString);
container.mount('foo', { group: ['create'] }, isString);
container.mount(other);                                  // nested container at root
container.mount({ group: ['x'] }, other);                // (options, container)
container.mount('user.address', address);                // nested container at sub-path
```

Only a container can be mounted **without a key** — a validator without a path is a `SyntaxError`.

## Mount paths

Paths are expanded at run-time by [pathtrace](https://www.npmjs.com/package/pathtrace):

| Syntax        | Matches                                                  |
|---------------|----------------------------------------------------------|
| `'email'`     | `data.email`                                             |
| `'user.name'` | `data.user.name`                                         |
| `'tags[0]'`   | `data.tags[0]`                                           |
| `'tags[*]'`   | every element of `data.tags`                             |
| `'**.foo'`    | every `.foo` field at any depth                          |

If a glob path expands to multiple keys, the validator runs once per expanded key.

## Mount options

```typescript
type MountOptions = {
    group?: string | string[];
    optional?: boolean | ((value: unknown) => boolean);
    optionalValue?: OptionalValue; // UNDEFINED | NULL | FALSY
    optionalInclude?: boolean;     // copy optional value through to output
};
```

See [Groups](/guide/groups) and [Optional Values](/guide/optional) for the full semantics.

## Run options

```typescript
type ContainerRunOptions<T, C> = {
    group?: string;
    flat?: boolean;                // skip the dotted-key → nested expansion
    path?: PropertyKey[];          // parent path prefix (used internally for nested containers)
    pathsToInclude?: string[];
    pathsToExclude?: string[];
    defaults?: Partial<T>;         // filled in for missing/undefined keys before return
    context?: C;                   // becomes ctx.context for every validator
    signal?: AbortSignal;          // cancellation
    parallel?: boolean;            // switch to runParallel
};
```

Run-time `pathsToInclude` / `pathsToExclude` take precedence over the container-level options.

## Output shape

By default `run()` returns a **nested object** built from the mount keys (so `'user.name'` writes to `output.user.name`). Pass `flat: true` to keep the dotted-key map.

```typescript
const c = new Container<{ user: { name: string } }>();
c.mount('user.name', isString);

await c.run({ user: { name: 'Peter' } });
// → { user: { name: 'Peter' } }

await c.run({ user: { name: 'Peter' } }, { flat: true });
// → { 'user.name': 'Peter' }
```

## Nested containers

Mount one container inside another to compose:

```typescript
const address = new Container<{ city: string; zip: string }>();
address.mount('city', isString);
address.mount('zip',  isString);

const user = new Container<{ name: string; address: { city: string; zip: string } }>();
user.mount('name', isString);
user.mount('address', address);
```

When the parent runs, it calls `address.run(data.address, { flat: true, path: ['address'] })` and merges the dotted-output back into the parent. Issue paths from the nested run are prefixed with the parent's mount key.

## Subclassing

Override `initialize()` to wire mounts from a constructor — useful for re-usable containers:

```typescript
class UserContainer extends Container<{ name: string; email: string }> {
    protected initialize() {
        this.mount('name', isString);
        this.mount('email', isEmail);
    }
}
```

`initialize()` runs once from the `Container` constructor, after `options` is set and before the first `mount()` call from outside.
