# Optional Values

Mount options control what counts as "absent" so you can cleanly skip optional fields without writing `if (value === undefined) return value;` in every validator.

```typescript
type MountOptions = {
    optional?: boolean | ((value: unknown) => boolean);
    optionalValue?: OptionalValue | OptionalValue[];
    optionalInclude?: boolean;
    // ... groups, etc.
};
```

`optional` is the **gate** — does this mount permit being skipped at all? `optionalValue` is the **definition** — which runtime values qualify as "absent"?

## `optional: boolean` + `optionalValue`

The vocabulary is atomic: each enum value matches exactly one runtime value. The only exception is `FALSY`, a composite shortcut for any JS falsy value.

| Atom                | Matches                          |
|---------------------|----------------------------------|
| `UNDEFINED`         | `value === undefined`            |
| `NULL`              | `value === null` (NOT undefined) |
| `EMPTY_STRING`      | `value === ''`                   |
| `ZERO`              | `value === 0`                    |
| `FALSE`             | `value === false`                |
| `NAN`               | `Number.isNaN(value)`            |
| `FALSY` (default)   | any of the above                 |

```typescript
import { Container, OptionalValue } from 'validup';

container.mount('description', { optional: true }, isString);
// → skipped when description is any falsy value
//   matches the typical form-input case where an untouched <input> holds ''

container.mount('phone', { optional: true, optionalValue: OptionalValue.NULL }, isPhone);
// → skipped only when phone === null

container.mount('age', { optional: true, optionalValue: OptionalValue.UNDEFINED }, isNumber);
// → skipped only when age === undefined (use this when 0 / '' / null are meaningful)
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
`NULL` matches `null` only — it does **not** also include `undefined`. Pass `[NULL, UNDEFINED]` (or use `FALSY`) when both should qualify. This was widened in pre-2.0 releases for ergonomic reasons; the atomic split is more predictable.
:::

::: warning FALSY as default
Before v2 the default was `UNDEFINED`. The switch to `FALSY` was made because the common case — `{ optional: true }` on a string-typed form field bound via `v-model` — only matched when the host code initialised the field as `undefined`, not `''`. The new default fits the form case out of the box; callers where `0` / `false` is a meaningful value should pick specific atoms or use the predicate form.
:::

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

## Optional + transforming validators

If the validator runs (the value is **not** considered optional), its return value is what gets written to the output. So a `null` value with `optional: false` will go through the validator like any other value — your validator can decide to accept `null` and return it unchanged.

`optional` is a fast-path for the common case; for more nuanced semantics, write the check directly into the validator.
