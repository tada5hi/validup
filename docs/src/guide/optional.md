# Optional Values

Mount options control what counts as "absent" so you can cleanly skip optional fields without writing `if (value === undefined) return value;` in every validator.

```typescript
type MountOptions = {
    optional?: boolean | ((value: unknown) => boolean);
    optionalValue?: OptionalValue; // UNDEFINED | NULL | FALSY
    optionalInclude?: boolean;
    // ... groups, etc.
};
```

## `optional: boolean` + `optionalValue`

```typescript
import { Container, OptionalValue } from 'validup';

container.mount('age', { optional: true }, isNumber);
// → skipped when age === undefined

container.mount('phone', { optional: true, optionalValue: OptionalValue.NULL }, isPhone);
// → skipped when phone === undefined OR phone === null

container.mount('referral', { optional: true, optionalValue: OptionalValue.FALSY }, isString);
// → skipped when referral is any falsy value (undefined, null, '', 0, false)
```

| `OptionalValue` | Skips when value is …                |
|-----------------|--------------------------------------|
| `UNDEFINED` (default) | `undefined` only                |
| `NULL`          | `null` or `undefined`                |
| `FALSY`         | any falsy value                      |

## Predicate `optional`

When the enum doesn't fit (e.g. drop empty strings but keep `0`), pass a predicate:

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
