# Caching

`Container.run` (and every other run variant) accepts an opt-in `cache` option that memoizes per-mount results. Pass a `ValidationCache` instance and the framework will skip any mount whose `(value, context, group)` snapshot matches a prior invocation — replaying the cached outcome instead of calling the validator again.

The optimization is most visible for forms with slow async validators (network round-trips, regex-heavy schemas): submit (`$validate()`) no longer pays the cost of re-running validators whose inputs the per-keystroke runs already proved fresh.

## Quick example

```typescript
import { Container, ValidationCache, defineValidator } from 'validup';

const container = new Container<{ email: string }>();
let calls = 0;
container.mount('email', defineValidator({
    run: async (ctx) => {
        calls += 1;
        // simulate an expensive check
        await new Promise((r) => setTimeout(r, 100));
        return ctx.value;
    },
}));

const cache = new ValidationCache();
const data = { email: 'peter@example.com' };

await container.run(data, { cache });
await container.run(data, { cache });
// calls === 1 — the second invocation hits the cache
```

## What counts as a cache hit

Three fields make up the snapshot:

| Field          | Equality      | Notes                                                                                       |
|----------------|---------------|---------------------------------------------------------------------------------------------|
| `ctx.value`    | `Object.is`   | Primitives by value; objects/arrays/functions by reference. A fresh literal misses.         |
| `ctx.context`  | `Object.is`   | Same — a new `context` object invalidates every mount under it.                             |
| `ctx.group`    | `Object.is`   | `string \| undefined`; switching groups always misses.                                      |

`ctx.data` is **not** part of the snapshot. A `sideEffect: false` mount declares it doesn't read sibling fields — only `value`, `context`, `group`. If your validator reads `ctx.data.password` from a `passwordConfirm` mount, mark it `sideEffect: true` (see below).

## Opting out: `sideEffect`

A validator that depends on inputs the snapshot doesn't cover — sibling fields, network state, global mutable data — must declare itself with `sideEffect: true` so the framework re-runs it every time:

```typescript
const validateUnique = defineValidator({
    sideEffect: true, // hits the network — never cache
    run: async (ctx) => {
        if (await api.isEmailTaken(ctx.value as string)) {
            throw new Error('Email is already taken');
        }
        return ctx.value;
    },
});
```

The same shape is exposed by the adapter packages:

```typescript
import { createValidator } from '@validup/zod';

container.mount('email', createValidator(
    z.string().refine(async (v) => await isEmailTaken(v)),
    { sideEffect: true },
));
```

`@validup/validator-js`'s shipped factories know their own contract — `equals(key)` (no `expectedValue`) automatically stamps `sideEffect: true` because it reads from `ctx.data[key]`; every other factory is cache-eligible by default.

## Lifecycle

The cache is **caller-owned**. `Container` never holds onto it; each `run()` consults whatever instance you pass. Typical patterns:

- **Per request** — instantiate one cache, run validation, drop it. The cache is effectively a memoization across the run tree (nested containers participate automatically).
- **Per session / per form** — instantiate one cache and reuse across multiple `run()` calls. `@validup/vue` does this — one cache per composable scope, cleared on `$reset()` and on container-ref swaps.
- **Custom storage** — implement `IValidationCache` directly for LRU eviction, TTL, persistence, etc.

```typescript
import type { IValidationCache } from 'validup';

class LruValidationCache implements IValidationCache {
    // ... your eviction logic ...
}
```

`isValidationCache(input)` is duck-typed (`get` / `set` / `delete` / `clear` are functions) so custom implementations work across package boundaries.

## When NOT to use it

The cache is opt-in for a reason: the soundness depends on `sideEffect` declarations being honest. If a validator silently reads `ctx.data.other` and isn't marked `sideEffect: true`, the cache will hand back stale results when `other` changes. For one-shot runs (CLI scripts, request handlers without UI feedback loops) the optimization rarely pays for itself — leave `cache` unset and every mount runs every time, which is the same behavior the library had before the option existed.

## Cross-references

- [Validator](/guide/validator) — `defineValidator` and the descriptor shape.
- [Run Modes](/guide/run-modes) — every variant (`run`, `runSync`, `runParallel`, `safeRun`, `safeRunSync`) accepts `cache`.
- [Vue Integration](/integrations/vue) — the composable's automatic per-scope cache.
