# Optional Values

Mount options control what counts as "absent" so you can cleanly skip optional fields without writing `if (value === undefined) return value;` in every validator.

```typescript
type MountOptions = {
    optional?: boolean | ((value: unknown) => boolean);
    optionalValue?: OptionalValue | OptionalValue[];
    optionalInclude?: boolean;
    optionalAs?: unknown;
    // ... groups, etc.
};
```

`optional` is the **gate** — does this mount permit being skipped at all? `optionalValue` is the **definition** — which runtime values qualify as "absent"?

## `optional: boolean` + `optionalValue`

The vocabulary is atomic: each enum value matches exactly one runtime value. The only exception is `FALSY`, a composite shortcut for any JS falsy value.

| Atom                  | Matches                          |
|-----------------------|----------------------------------|
| `UNDEFINED` (default) | `value === undefined`            |
| `NULL`                | `value === null` (NOT undefined) |
| `EMPTY_STRING`        | `value === ''`                   |
| `ZERO`                | `value === 0`                    |
| `FALSE`               | `value === false`                |
| `NAN`                 | `Number.isNaN(value)`            |
| `FALSY`               | any of the above                 |

```typescript
import { Container, OptionalValue } from 'validup';

container.mount('age', { optional: true }, isNumber);
// → skipped only when age === undefined (the conservative default)

container.mount('phone', { optional: true, optionalValue: OptionalValue.NULL }, isPhone);
// → skipped only when phone === null

container.mount('description', {
    optional: true,
    optionalValue: [OptionalValue.UNDEFINED, OptionalValue.EMPTY_STRING],
}, isString);
// → skipped on undefined OR '' (the form-input case where an untouched
//   <input> bound via v-model holds '')
```

### Composing atoms with an array

Pass an array to skip on **any** of the listed atoms. This is how you build custom sets without reaching for a predicate:

```typescript
container.mount('name', {
    optional: true,
    optionalValue: [OptionalValue.UNDEFINED, OptionalValue.NULL, OptionalValue.EMPTY_STRING],
}, isString);
// → skipped on undefined OR null OR '' (the common "missing or blank" intent)
```

An empty array (`optionalValue: []`) matches nothing — the mount is effectively non-optional.

::: warning NULL semantics
`NULL` matches `null` only — it does **not** also include `undefined`. Pass `[NULL, UNDEFINED]` (or use `FALSY`) when both should qualify. This was widened in earlier releases for ergonomic reasons; the atomic split is more predictable.
:::

::: tip Form inputs
For form fields where an untouched `<input>` holds `''` (bound via `v-model`), the per-mount escape is `optionalValue: [UNDEFINED, EMPTY_STRING]`. Or thread the same default through the whole run via `ContainerRunOptions.optionalValue` — `@validup/vue` does this automatically (`['undefined', 'empty_string']`), so individual mounts only need to override when they want something different.
:::

## Run-level fallback (`ContainerRunOptions.optionalValue`)

The same vocabulary is accepted at the run level as a fallback when a mount doesn't set its own `optionalValue`. Useful when a single decision applies to every optional mount in a form / API surface:

```typescript
await container.run(input, {
    optionalValue: ['undefined', 'empty_string'],
});
```

Precedence: per-mount `MountOptions.optionalValue` wins over the run-level fallback. When neither is set, the core default `'undefined'` applies. The run-level value is forwarded into nested container `run()` calls so the entire sub-tree picks it up unless a child mount overrides.

## Predicate `optional`

When the atom vocabulary doesn't fit (e.g. depends on context), pass a predicate:

```typescript
container.mount('bio', { optional: (v) => typeof v === 'string' && v.trim() === '' }, isBio);
```

The predicate wins over `optionalValue` when both are present.

## `optionalInclude`

By default, an optional skip means the key is **omitted from the output**. If you want to preserve the value (without running the validator), set `optionalInclude: true`:

```typescript
container.mount('phone', {
    optional: true,
    optionalValue: OptionalValue.NULL,
    optionalInclude: true,
}, isPhone);

await container.run({ phone: null });
// → { phone: null }   (key preserved)

await container.run({});
// → {}                (key absent in input → still absent in output)
```

This is useful when you need to distinguish "user explicitly set null" from "user omitted the field".

## `optionalAs` (canonical normalization)

When you want every optional sentinel to collapse to one canonical value (e.g. the backend expects `null` for "no value provided", but the form holds `''`), set `optionalAs`:

```typescript
container.mount('description', {
    optional: true,
    optionalValue: [OptionalValue.UNDEFINED, OptionalValue.NULL, OptionalValue.EMPTY_STRING],
    optionalAs: null,
}, isString);

await container.run({ description: '' });          // → { description: null }
await container.run({ description: undefined });   // → { description: null }
await container.run({ description: null });        // → { description: null }
await container.run({ description: 'value' });     // → { description: 'value' }  (validator ran)
```

`optionalAs` implies include semantics and wins when paired with `optionalInclude`. Presence — not value — matters: `{ optionalAs: undefined }` is a meaningful directive ("emit the key as `undefined`") and differs from omitting the option.

## Optional + transforming validators

If the validator runs (the value is **not** considered optional), its return value is what gets written to the output. So a `null` value with `optional: false` will go through the validator like any other value — your validator can decide to accept `null` and return it unchanged.

`optional` is a fast-path for the common case; for more nuanced semantics, write the check directly into the validator.
