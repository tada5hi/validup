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

## Custom codes

`IssueCode` is paired with a declaration-mergeable `IssueCodeRegistry` interface — you can add typed codes via module augmentation:

```typescript
declare module 'validup' {
    interface IssueCodeRegistry {
        EMAIL_TAKEN: 'EMAIL_TAKEN';
    }
}

throw new ValidupError([
    defineIssueItem({
        code: 'EMAIL_TAKEN',
        path: ['email'],
        message: 'Email already in use.',
    }),
]);
```

The `(string & {})` widening keeps ad-hoc string codes working too — the registry is purely for type-level autocomplete.
