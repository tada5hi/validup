# validup 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A composable, path-based validation library for TypeScript.

Mount any validator function (or nested container) onto any path of your input, run them in groups, collect structured issues, and bridge to existing libraries via adapters. No decorators, no schema DSL, no metadata reflection.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
  - [Validators](#validators)
  - [Containers](#containers)
  - [Issues & Errors](#issues--errors)
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
- [Safe Run](#safe-run)
- [Error Handling](#error-handling)
  - [ValidupError](#validuperror)
  - [Issue Shape](#issue-shape)
  - [Issue Codes](#issue-codes)
- [API Reference](#api-reference)
  - [Container](#container)
  - [Issue Helpers](#issue-helpers)
  - [Type Guards](#type-guards)
- [Adapters](#adapters)
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
type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;

type ValidatorContext = {
    key: string;            // expanded mount path within the current container
    path: PropertyKey[];    // global mount path including parent containers
    value: unknown;         // the value to validate
    data: Record<string, any>; // input of the current container
    group?: string;         // active execution group, if any
};
```

A validator's **return value** becomes the output for that path — so validators double as transformers/sanitizers.

### Containers

A `Container<T>` holds an ordered list of mounts and runs them against an input object. The optional generic `T` constrains mount keys and shapes the resolved output.

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
import { createValidator } from '@validup/adapter-zod';
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

## oneOf Branches

A container created with `{ oneOf: true }` succeeds if **any one** of its mounts succeeds. Failures are aggregated into a single `IssueGroup` only when **all** branches fail.

```typescript
const credential = new Container({ oneOf: true });

credential.mount('email',    createEmailValidator());
credential.mount('username', createUsernameValidator());

await credential.run({ email: 'peter@example.com' });
// → { email: 'peter@example.com' } — username branch failure is ignored

await credential.run({ email: 'not-an-email', username: 'invalid' });
// → throws ValidupError with one IssueGroup (code: 'one_of_failed')
```

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

## Safe Run

`safeRun()` returns a discriminated `Result<T>` instead of throwing — handy when you want to deal with errors without `try/catch`:

```typescript
const result = await container.safeRun(input);

if (result.success) {
    console.log(result.data);   // T
} else {
    console.error(result.error.issues); // ValidupError
}
```

## Error Handling

### ValidupError

```typescript
class ValidupError extends Error {
    readonly issues: Issue[];
}
```

The `message` is auto-built from the failing paths (`Property foo is invalid`, `Properties foo, bar are invalid`).

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

| Code                          | When                                                  |
|-------------------------------|-------------------------------------------------------|
| `IssueCode.VALUE_INVALID`     | Default for any `defineIssueItem(...)` without a code |
| `IssueCode.ONE_OF_FAILED`     | All branches of a `oneOf` container failed            |

## API Reference

### Container

```typescript
class Container<T extends Record<string, any> = Record<string, any>> implements IContainer<T> {
    constructor(options?: ContainerOptions<T>);

    mount(container: IContainer): void;
    mount(options: MountOptions, container: IContainer): void;
    mount(key: Path<T>, data: IContainer | Validator): void;
    mount(key: Path<T>, options: MountOptions, data: IContainer | Validator): void;

    run(input?: Record<string, any>, options?: ContainerRunOptions<T>): Promise<T>;
    safeRun(input?: Record<string, any>, options?: ContainerRunOptions<T>): Promise<Result<T>>;
}
```

| Option                    | Where                  | Description                                                       |
|---------------------------|------------------------|-------------------------------------------------------------------|
| `oneOf`                   | `ContainerOptions`     | Succeed when any mount succeeds                                   |
| `pathsToInclude`          | `ContainerOptions`, `ContainerRunOptions` | Only mount paths in this list are executed     |
| `pathsToExclude`          | `ContainerOptions`, `ContainerRunOptions` | Mount paths in this list are skipped           |
| `defaults`                | `ContainerRunOptions`  | Fallback values for missing/`undefined` keys                      |
| `group`                   | `ContainerRunOptions`  | Active group (only matching mounts run; `'*'` runs everything)    |
| `flat`                    | `ContainerRunOptions`  | When `true`, the output is a dotted-key map instead of nested     |
| `path`                    | `ContainerRunOptions`  | Used internally when nesting; rarely set by hand                  |
| `group` (mount)           | `MountOptions`         | Group(s) this mount belongs to (`string \| string[]`)             |
| `optional`                | `MountOptions`         | Skip this mount when value is "optional"                          |
| `optionalValue`           | `MountOptions`         | What counts as optional: `'undefined'` / `'null'` / `'falsy'`     |
| `optionalInclude`         | `MountOptions`         | Copy optional value into the output instead of dropping it        |

### Issue Helpers

| Export                | Purpose                                              |
|-----------------------|------------------------------------------------------|
| `defineIssueItem`     | Construct an `IssueItem` (sets `type`, default code) |
| `defineIssueGroup`    | Construct an `IssueGroup` (sets `type`)              |
| `IssueCode`           | Built-in issue codes (`VALUE_INVALID`, `ONE_OF_FAILED`) |
| `GroupKey`            | `WILDCARD = '*'`                                     |
| `OptionalValue`       | `UNDEFINED` / `NULL` / `FALSY`                       |

### Type Guards

| Export                | Returns                                              |
|-----------------------|------------------------------------------------------|
| `isValidupError(e)`   | `e is ValidupError` (duck-typed across package copies) |
| `isError(e)`          | `e is Error & {[key: string]: any}`                  |
| `isContainer(x)`      | `x is IContainer` (duck-typed)                       |
| `isIssue(x)`          | `x is Issue`                                         |
| `isIssueItem(x)`      | `x is IssueItem`                                     |
| `isIssueGroup(x)`     | `x is IssueGroup`                                    |

## Adapters

Use one of the official adapters to bridge an existing validator library or framework into validup:

| Adapter                                                               | Bridges to                                                               |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------|
| [`@validup/adapter-zod`](https://npmjs.com/package/@validup/adapter-zod) | [zod](https://zod.dev) schemas                                          |
| [`@validup/adapter-validator`](https://npmjs.com/package/@validup/adapter-validator) | [express-validator](https://express-validator.github.io) chains |
| [`@validup/adapter-routup`](https://npmjs.com/package/@validup/adapter-routup) | [routup](https://routup.net) request inputs (body / query / cookies / params) |

## License

Made with 💚

Published under [MIT License](./LICENSE).

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
