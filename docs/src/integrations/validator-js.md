# @validup/validator-js

Pre-baked factories for [validator.js](https://github.com/validatorjs/validator.js) string validators (`isEmail`, `isLength`, `isInt`, `isURL`, …) plus a generic `createValidator(fn, { code, message })` for the long tail. Each factory stamps the right `IssueCode` on failure with structured `params`, so consumer-side i18n catalogs (`@ilingo/validup`) can translate per code.

```bash
npm install @validup/validator-js validator validup --save
```

| Peer dependency | Supported versions |
|-----------------|--------------------|
| `validup`       | `^1.0.0`           |
| `validator`     | `^13.0.0`          |

## Quick Start

```typescript
import { Container } from 'validup';
import {
    isEmail,
    isLength,
    isInt,
    isURL,
    matches,
    equals,
} from '@validup/validator-js';

const container = new Container<{
    email: string;
    name: string;
    age: number;
    site: string;
    zip: string;
    password: string;
    confirm: string;
}>();

container.mount('email',   isEmail());
container.mount('name',    isLength({ min: 3, max: 50 }));
container.mount('age',     isInt({ min: 18, max: 120 }));
container.mount('site',    isURL({ require_protocol: true }));
container.mount('zip',     matches(/^\d{5}$/));
container.mount('confirm', equals('password')); // compares ctx.value against ctx.data.password
```

## Factories

Every factory takes a single flat options object — the validup-side `message` override sits alongside the validator.js options for that rule (`BaseFactoryOptions & validator.Is*Options`).

| Factory | Emits | `params` payload |
|---------|-------|------------------|
| `isEmail(opts?)` | `EMAIL` | — |
| `isURL(opts?)` | `URL` | — |
| `isUUID(opts?)` | `UUID` | — |
| `isIP(opts?)` | `IP_ADDRESS` | — |
| `isMACAddress(opts?)` | `MAC_ADDRESS` | — |
| `isDate(opts?)` | `DATE` | — |
| `isISO8601(opts?)` | `DATE` | — |
| `isJSON(opts?)` | `JSON` | — |
| `isBase64(opts?)` | `BASE64` | — |
| `isStrongPassword(opts?)` | `STRONG_PASSWORD` | `{ minLength?, minLowercase?, … }` |
| `isAlpha(opts?)` | `ALPHA` | — |
| `isAlphanumeric(opts?)` | `ALPHA_NUM` | — |
| `isNumeric(opts?)` | `NUMERIC` | — |
| `isDecimal(opts?)` | `DECIMAL` | — |
| `isInt(opts?)` | `INTEGER` *or* `MIN_VALUE` / `MAX_VALUE` | `{ min }` / `{ max }` on range failure |
| `isFloat(opts?)` | `DECIMAL` *or* `MIN_VALUE` / `MAX_VALUE` | `{ min }` / `{ max }` on range failure |
| `isLength(opts?)` | `MIN_LENGTH` *or* `MAX_LENGTH` (detects which bound failed) | `{ min }` / `{ max }` |
| `matches(pattern, opts?)` | `PATTERN` | `{ pattern: string }` |
| `equals(key, opts?)` | `SAME_AS` | `{ other: string }` |

`isInt` / `isFloat` / `isLength` distinguish type-failure vs. range-failure on output, so i18n catalogs can ship distinct messages ("must be between 18 and 120" ≠ "must be an integer").

`equals(key)` reads the comparison target from `ctx.data` at the `key` path (pathtrace) — so `equals('password')` mounted on `confirm` compares against `ctx.data.password`. Pass `{ expectedValue: 'literal' }` to compare against a fixed string instead; `key` still supplies the `{ other }` label for i18n templates.

## Generic wrap — `createValidator`

For validators not pre-baked (`isCreditCard`, `isJWT`, `isMobilePhone`, `isPostalCode`, …):

```typescript
import validator from 'validator';
import { createValidator } from '@validup/validator-js';

container.mount('card', createValidator(validator.isCreditCard, {
    code: 'credit_card',
    message: 'Invalid credit card number',
}));
```

Accepts any `(value: string, ...args: any[]) => boolean` predicate. Takes `{ code, message, params? }`. Throws a `ValidupError` carrying a single `IssueItem` on failure.

## Composing factories

For fields that need multiple checks, use validup's `compose` helper:

```typescript
import { compose } from 'validup';
import { isEmail, isLength } from '@validup/validator-js';

// Fail-fast (default) — first failure stops the chain, output threads through.
container.mount('email', compose([isEmail(), isLength({ max: 254 })]));

// Collect-all — every rule runs against ctx.value; failures aggregate.
container.mount('password', compose([
    isLength({ min: 8 }),
    isAlphanumeric(),
    matches(/[0-9]/),
], { bail: false }));
```

## License

Apache-2.0 © Peter Placzek
