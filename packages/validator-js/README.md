# @validup/validator-js 🛡️

A [validup](https://www.npmjs.com/package/validup) integration for [validator.js](https://github.com/validatorjs/validator.js) — pre-baked factories for the common string validators (`isEmail`, `isLength`, `isInt`, …) plus a generic `createValidator(fn, …)` for the long tail.

Each factory stamps the right validup [`IssueCode`](https://www.npmjs.com/package/validup#issue-codes) on failure, with structured `params` matching the i18n catalog's placeholders. Drop into `@ilingo/validup` for free per-rule translations.

**Replaces** `@validup/express-validator`. validator.js is the underlying library express-validator wraps; using it directly removes the Express-chain abstraction we don't need and gives the adapter structural knowledge of which validator fired (so no `.withMessage({code, message})` dance).

## Installation

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
    confirm: string;
}>();

container.mount('email',   isEmail());
container.mount('name',    isLength({ min: 3, max: 50 }));
container.mount('age',     isInt({ min: 18, max: 120 }));
container.mount('site',    isURL({ require_protocol: true }));
container.mount('zip',     matches(/^\d{5}$/));
container.mount('confirm', equals('password'));

const valid = await container.run({
    email: 'peter@example.com',
    name: 'Peter',
    age: 28,
    site: 'https://example.com',
    zip: '12345',
    confirm: 'password',
});
```

## Factories

Every factory takes a **flat options object** — the validup-side `message` override sits alongside the validator.js options for that rule (`BaseFactoryOptions & validator.Is*Options`). No nesting; one shape per call site.

| Factory | Options type | Emits | `params` payload |
|---------|--------------|-------|------------------|
| `isEmail(opts?)` | `BaseFactoryOptions & validator.IsEmailOptions` | `EMAIL` | — |
| `isURL(opts?)` | `BaseFactoryOptions & validator.IsURLOptions` | `URL` | — |
| `isUUID(opts?)` | `BaseFactoryOptions & { version? }` | `UUID` | — |
| `isIP(opts?)` | `BaseFactoryOptions & { version? }` | `IP_ADDRESS` | — |
| `isMACAddress(opts?)` | `BaseFactoryOptions & validator.IsMACAddressOptions` | `MAC_ADDRESS` | — |
| `isDate(opts?)` | `BaseFactoryOptions & validator.IsDateOptions` | `DATE` | — |
| `isISO8601(opts?)` | `BaseFactoryOptions & validator.IsISO8601Options` | `DATE` | — |
| `isJSON(opts?)` | `BaseFactoryOptions & validator.IsJSONOptions` | `JSON` | — |
| `isBase64(opts?)` | `BaseFactoryOptions & validator.IsBase64Options` | `BASE64` | — |
| `isStrongPassword(opts?)` | `BaseFactoryOptions & validator.StrongPasswordOptions` | `STRONG_PASSWORD` | `{ minLength?, minLowercase?, minUppercase?, minNumbers?, minSymbols? }` |
| `isAlpha(opts?)` | `BaseFactoryOptions & validator.IsAlphaOptions & { locale? }` | `ALPHA` | — |
| `isAlphanumeric(opts?)` | `BaseFactoryOptions & validator.IsAlphanumericOptions & { locale? }` | `ALPHA_NUM` | — |
| `isNumeric(opts?)` | `BaseFactoryOptions & validator.IsNumericOptions` | `NUMERIC` | — |
| `isDecimal(opts?)` | `BaseFactoryOptions & validator.IsDecimalOptions` | `DECIMAL` | — |
| `isInt(opts?)` | `BaseFactoryOptions & validator.IsIntOptions` | `INTEGER` *or* `MIN_VALUE` / `MAX_VALUE` | `{ min }` / `{ max }` on range failure |
| `isFloat(opts?)` | `BaseFactoryOptions & validator.IsFloatOptions` | `DECIMAL` *or* `MIN_VALUE` / `MAX_VALUE` | `{ min }` / `{ max }` on range failure |
| `isLength(opts?)` | `BaseFactoryOptions & validator.IsLengthOptions` | `MIN_LENGTH` *or* `MAX_LENGTH` | `{ min }` / `{ max }` |
| `matches(pattern, opts?)` | `BaseFactoryOptions & { modifiers? }` | `PATTERN` | `{ pattern: string }` |
| `equals(comparison, opts?)` | `BaseFactoryOptions & { expectedValue? }` | `SAME_AS` | `{ other: string }` |

Examples:

```ts
isEmail({ require_display_name: true, message: 'Must include name' });
isInt({ min: 18, max: 120, message: 'Must be 18–120' });
isLength({ min: 3, max: 50 });
isURL({ require_protocol: true, protocols: ['https'] });
isAlpha({ locale: 'de-DE', ignore: '-' });
isStrongPassword({ minLength: 12, minNumbers: 2 });
```

**`isInt` / `isFloat` / `isLength` are intentionally split.** A failure can be either a type mismatch (`'abc'` for an integer) or a range mismatch (`5` when min is `18`). Validator.js collapses both into a single boolean, so the factory checks them in order and emits the most specific code for each case — that's what makes the i18n story useful ("must be between 18 and 120" vs. "must be an integer" are different messages).

## Generic wrap — `createValidator`

For validators not pre-baked (`isCreditCard`, `isJWT`, `isMobilePhone`, `isPostalCode`, …):

```typescript
import validator from 'validator';
import { createValidator } from '@validup/validator-js';

container.mount('card', createValidator(validator.isCreditCard, {
    code: 'credit_card',
    message: 'Invalid credit card number',
}));

container.mount('phone', createValidator(
    (v) => validator.isMobilePhone(v, 'de-DE'),
    {
        code: 'mobile_phone',
        params: { locale: 'de-DE' },
        message: 'Invalid German mobile number',
    },
));
```

`createValidator(fn, { code, message, params? })`:

- `fn` — any function with the signature `(value: string, ...args: any[]) => boolean`. validator.js's predicates all fit.
- `code` — the validup `IssueCode` (or any project-specific string) attached to the resulting `IssueItem`. `IssueItem.code` widens to `IssueCode | (string & {})`, so ad-hoc strings are accepted.
- `message` — fallback English message on `IssueItem.message`. Always set this — i18n catalogs key off `code`, but consumers without an i18n setup see the message directly.
- `params` — structured payload surfaced on `IssueItem.params`. Optional; templates that reference placeholders (`{{locale}}`, `{{min}}`, …) resolve against this.

The wrap stringifies `ctx.value` via `toValidatorString` before calling `fn` — same as the factories — so consumers can mount on `number`-shaped fields without manual coercion.

## Per-call message override

Every factory accepts `{ message }` to override the default:

```typescript
container.mount('email', isEmail({ message: 'Bad email' }));
container.mount('name',  isLength({ min: 3, message: 'Name too short' }));
```

Defaults match `@ilingo/validup`'s `en` catalog wording, so consumers without i18n see consistent strings.

## Why not express-validator?

express-validator wraps validator.js in a chain API meant for Express middleware. validup doesn't use Express's `req` / `body` / `query` routing — it has its own `Container.mount` for path traversal. The chain abstraction added complexity (no machine-readable validator identity through `ValidationError`, so codes had to come from `.withMessage({ code, message })` opt-ins) without payoff.

`@validup/validator-js` replaces `@validup/express-validator` outright. Migration is mechanical:

```diff
- container.mount('email', createValidator(() => body().isEmail()));
+ container.mount('email', isEmail());

- container.mount('name', createValidator(() => body()
-     .isLength({ min: 3 })
-     .withMessage({ code: IssueCode.MIN_LENGTH, message: 'Too short' })));
+ container.mount('name', isLength({ min: 3, message: 'Too short' }));
```

## License

Apache-2.0 © Peter Placzek
