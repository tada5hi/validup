# Issues & Errors

`Issue = IssueItem | IssueGroup` is the structured failure record validup produces. They're discriminated by `type`, recursive (groups can wrap groups), and carry a structured payload (`params`) so the message can be re-rendered later in another locale.

## `IssueItem`

```typescript
interface IssueItem {
    type: 'item';
    code: IssueCode | (string & {}); // IssueCode.VALUE_INVALID by default
    path: PropertyKey[];
    message: string;
    received?: unknown;
    expected?: unknown;
    params?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
```

## `IssueGroup`

```typescript
interface IssueGroup {
    type: 'group';
    code?: IssueCode | (string & {}); // e.g. IssueCode.ONE_OF_FAILED
    path: PropertyKey[];
    message: string;
    issues: Issue[]; // recursive
    params?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
```

## Constructing issues

Always use the factories — they set `type` and provide sensible defaults:

```typescript
import { defineIssueItem, defineIssueGroup, IssueCode } from 'validup';

const item = defineIssueItem({
    code: IssueCode.VALUE_INVALID,
    path: ['email'],
    message: 'Invalid email address',
    received: 'not-an-email',
    expected: 'email-format',
    params: { name: 'email' },
});

const group = defineIssueGroup({
    path: ['credentials'],
    message: 'Credentials are invalid',
    issues: [item],
});
```

## `meta` conventions

`meta` is an open `Record<string, unknown>` because issues travel across package boundaries — integration adapters, frameworks, and apps each have provenance the core can't know about. To keep the bag focused, **library-owned `meta` keys are limited to provenance the consumer cannot reconstruct from `path` + container config.** Presentation tokens (e.g. severity) and reconstructible facts (e.g. the active `group`) don't qualify.

Two keys are library-owned today:

| Key             | Set by                                                          | What it means                                                                                       |
|-----------------|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `optional?: true` | Core runtime, when the originating mount's `optional` declaration resolves truthy for the current value. `optional: true` always tags; `optional: false` and `undefined` never do; `optional: (v) => boolean` is invoked with the value and tags iff truthy (in practice always false at error time, since the validator would have been skipped otherwise). | The mount permits this field being skipped. Useful for downgrading UX severity (e.g. show a warning instead of an error when an optional field's content is invalid). |
| `external?: true` | Frameworks injecting server-side issues (e.g. `@validup/vue`'s `setExternalIssues`).        | Distinguishes server-supplied from validator-supplied so themes can render the distinction.        |

### `meta.optional` — no inheritance

`meta.optional` reflects only the **most-local** mount's config. Inside a child container mounted as optional, the child's own mounts retain their own `optional` status independently:

```typescript
const role = new Container<{ name: string }>();
role.mount('name', stringValidator);                  // required inside Role

const user = new Container();
user.mount('role', { optional: true }, role);         // role itself is optional

await user.run({ role: { name: 42 } });               // throws ValidupError
// - issue at ['role']: type 'group', meta: { optional: true }   ← parent's optional config
// - leaf at ['role', 'name']: meta: undefined                   ← child's own mount was required
```

The rationale: "role is optional" means *you don't have to provide a role*. Once you do, the role's own required fields stay required. The wrapping group at `['role']` carries the parent's optional flag; the leaf at `['role', 'name']` does not, because its own mount declared no optional config.

Apps and third-party validators may add their own `meta` keys (e.g. `meta.componentId: 'role-name-input'`) — the open shape is intentional. Naming clashes are the responsibility of the producer.

## `ValidupError`

```typescript
class ValidupError extends BaseError {
    readonly code = 'VALIDUP_ERROR';
    readonly issues: Issue[];
    toJSON(): unknown;
}
```

`ValidupError` extends `@ebec/core`'s `BaseError`. It carries a `code`, an optional `cause`, the collected `issues`, and a `toJSON()` overridden to include `issues`. The `.message` is auto-built from issue paths — useful as a default human-readable summary.

## `isValidupError`

Use the duck-type guard rather than `instanceof` — it works across realm boundaries (e.g. multiple bundled copies of the package, or thrown from a worker):

```typescript
import { isValidupError } from 'validup';

try {
    await container.run(data);
} catch (e) {
    if (isValidupError(e)) {
        for (const issue of e.issues) {
            console.error(issue.path.join('.'), '→', issue.message);
        }
    }
}
```

The guard returns `true` if `e instanceof ValidupError` **or** if `e.issues` is a valid array.

## Helpers

```typescript
import {
    isIssue, isIssueItem, isIssueGroup,
    flattenIssueItems, flattenIssueGroups,
    formatIssue,
    buildErrorMessageForAttribute, buildErrorMessageForAttributes,
    stringifyPath,
} from 'validup';
```

| Helper                     | Purpose                                                             |
|----------------------------|---------------------------------------------------------------------|
| `isIssue(x)`               | Discriminate any value                                              |
| `isIssueItem(x)`           | Narrow to `IssueItem`                                               |
| `isIssueGroup(x)`          | Narrow to `IssueGroup`                                              |
| `flattenIssueItems(issues)`| Recurse into groups, return only the leaf items                     |
| `flattenIssueGroups(issues)`| Recurse, return only the groups                                    |
| `formatIssue(issue, templates?)` | Re-render `message` using `params` against your templates       |
| `buildErrorMessageForAttribute('email')` | `'Property "email" is invalid.'`                          |
| `stringifyPath([...])`     | Render a `PropertyKey[]` as `'a.b[0].c'`                            |

## Issue code vocabulary

validup ships a vocabulary of well-known issue codes that adapter packages (`@validup/zod`, `@validup/validator-js`) map onto and that i18n catalogs (`@ilingo/validup`) translate from. The vocabulary tracks the common ground across vuelidate, zod, joi, and yup — enough that a translation catalog can ship one localized string per code instead of a generic "invalid value" fallback.

| Theme | Code | When | `params` |
|-------|------|------|----------|
| **Generic / structural** | `VALUE_INVALID` | Default for any `defineIssueItem(...)` without a code | — |
|                          | `ONE_OF_FAILED` | All branches of a `oneOf` container failed | — |
| **Presence**             | `REQUIRED` | Value is missing, `undefined`, `null`, or empty | — |
| **Type assertions**      | `ALPHA` | Value contains characters outside the alphabetical set | — |
|                          | `ALPHA_NUM` | Value contains characters outside the alphanumeric set | — |
|                          | `NUMERIC` | Value is not a number | — |
|                          | `INTEGER` | Value is not an integer | — |
|                          | `DECIMAL` | Value is not a decimal number | — |
| **Length**               | `MIN_LENGTH` | Value is shorter than the configured minimum | `{ min: number }` |
|                          | `MAX_LENGTH` | Value is longer than the configured maximum | `{ max: number }` |
| **Numeric range**        | `MIN_VALUE` | Numeric value is below the configured minimum | `{ min: number }` |
|                          | `MAX_VALUE` | Numeric value is above the configured maximum | `{ max: number }` |
|                          | `BETWEEN` | Numeric value falls outside `[min, max]` | `{ min: number, max: number }` |
| **String format**        | `EMAIL` | Value is not a valid email address | — |
|                          | `URL` | Value is not a valid URL | — |
|                          | `IP_ADDRESS` | Value is not a valid IP address | — |
|                          | `MAC_ADDRESS` | Value is not a valid MAC address | — |
|                          | `UUID` | Value is not a valid UUID | — |
|                          | `DATE` | Value is not a valid / parseable date | — |
|                          | `PATTERN` | Value does not match the expected regex | `{ pattern: string }` |
|                          | `JSON` | Value is not valid JSON | — |
|                          | `BASE64` | Value is not valid base64 | — |
|                          | `STRONG_PASSWORD` | Value doesn't meet the configured strength rules | `{ minLength?, minLowercase?, minUppercase?, minNumbers?, minSymbols? }` |
| **Comparison**           | `SAME_AS` | Value must equal another named field's value (e.g. password-confirm) | `{ other: string }` |

Adapters are responsible for mapping foreign codes onto the vocabulary. When a foreign code has no direct match, the adapter falls back to `IssueCode.VALUE_INVALID` and the consumer-side template uses the eagerly-rendered English `issue.message`.

## Custom codes

`IssueItem.code` is widened to `IssueCode | (string & {})`, so any literal string works at runtime:

```typescript
defineIssueItem({ code: 'email_taken', path: ['email'], message: 'Already taken.' });
// → accepted; downstream code paths treat it like any other code
```

For typed autocomplete on project-specific codes, define your own const that spreads the shipped vocabulary:

```typescript
import { IssueCode } from 'validup';

export const AppCode = {
    ...IssueCode,
    EMAIL_TAKEN: 'email_taken',
    RATE_LIMITED: 'rate_limited',
} as const;

export type AppCode = typeof AppCode[keyof typeof AppCode];

throw new ValidupError([
    defineIssueItem({
        code: AppCode.EMAIL_TAKEN,
        path: ['email'],
        message: 'Email already in use.',
    }),
]);
```
