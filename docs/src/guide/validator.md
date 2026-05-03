# Validator

A `Validator<C>` is the smallest unit of work in validup:

```typescript
type ValidatorContext<C = unknown> = {
    key: string;            // expanded mount path inside the current container
    path: PropertyKey[];    // global mount path including parent containers
    value: unknown;         // the value to validate
    data: Record<string, any>; // input of the current container
    group?: string;
    context: C;
    signal?: AbortSignal;
};

type Validator<C = unknown> =
    (ctx: ValidatorContext<C>) => Promise<unknown> | unknown;
```

It receives the field's current value (plus the surrounding context), and either:

- **Returns a value** — written to `output[key]`. Returning a transformed value is how you parse/coerce in the same pass.
- **Throws** — converted to an `Issue`. Any thrown `Error.message` becomes the issue message; a thrown `ValidupError` contributes its `.issues` re-pathed under the current mount.

## Writing a validator

```typescript
import type { Validator } from 'validup';

const isPositiveInt: Validator = ({ value, key }) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        throw new Error(`${key} must be a positive integer.`);
    }
    return value;
};
```

Use it like any other mount target:

```typescript
container.mount('age', isPositiveInt);
container.mount('count', { optional: true }, isPositiveInt);
```

## Transforming values

A validator can return a parsed value (different from `value`):

```typescript
const toDate: Validator = ({ value, key }) => {
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`${key} must be a valid ISO date.`);
    }
    return d; // Container output now contains a Date instead of a string
};
```

Sequential `run` reads sibling output if a previous mount has populated it (`hasOwnProperty(output, key)`), so a sanitize-then-validate chain on the same path works:

```typescript
container.mount('name', sanitizeName); // returns trimmed string
container.mount('name', isString);     // sees the trimmed value
```

> **Note:** parallel mode (`opts.parallel: true`) reads `value` from the input data only, skipping the sibling-output read. Use sequential mode for sanitize-then-validate chains.

## Lazy / context-aware validators

The integration adapters (`@validup/zod`, `@validup/standard-schema`, `@validup/express-validator`) accept either a schema/chain or a function `(ctx) => schema/chain`. The function form lets you build a per-call schema from `ctx.group`, `ctx.context`, or `ctx.data`.

For your own validators, the same pattern is just a closure:

```typescript
const isUniqueEmail = (db: Db): Validator => async ({ value }) => {
    if (await db.users.findOne({ email: value })) {
        throw new Error('Email already in use.');
    }
    return value;
};

container.mount('email', isUniqueEmail(db));
```

If you'd rather thread context through the run rather than capture it in a closure, use the `Container<T, C>` second generic and read `ctx.context`:

```typescript
const isUniqueEmail: Validator<{ db: Db }> = async ({ value, context }) => {
    if (await context.db.users.findOne({ email: value })) {
        throw new Error('Email already in use.');
    }
    return value;
};

const c = new Container<{ email: string }, { db: Db }>();
c.mount('email', isUniqueEmail);

await c.run({ email: 'peter@example.com' }, { context: { db } });
```

## Sync vs async

Validators may be sync or async. `run()` always awaits; `runSync()` throws if the return value is thenable. Use sync validators for reactive UIs that should not flicker through a `pending` state.

## Cancellation

If the run was started with `{ signal }`, the validator receives the same `signal` in `ctx.signal`. Forward it to async work that supports cancellation:

```typescript
const fetchProfile: Validator = async ({ value, signal }) => {
    const r = await fetch(`/profile/${value}`, { signal });
    return r.json();
};
```

Throwing an abort error mid-validator propagates verbatim — it is **not** folded into the issue list. See [Cancellation](/guide/cancellation).
