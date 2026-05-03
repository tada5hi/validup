# One-Of

Set `oneOf: true` on a container to flip its semantics: succeed if **any** mount passes; fail only when **every** mount fails. The collected failures are then wrapped in a single `IssueGroup` with `code: ONE_OF_FAILED`.

## When to use it

- "Sign in with email **or** phone" — accept either credential shape.
- "Address can be a string **or** a structured object."
- Any branch validation where multiple shapes are allowed.

## Example: email or phone

```typescript
import { Container, type Validator } from 'validup';

const isEmail: Validator = ({ value, key }) => { /* ... */ return value; };
const isPhone: Validator = ({ value, key }) => { /* ... */ return value; };

const credentials = new Container<{ email?: string; phone?: string }>({
    oneOf: true,
});

credentials.mount('email', isEmail);
credentials.mount('phone', isPhone);

// Succeeds — phone passes
await credentials.run({ phone: '+49-30-1234567' });

// Throws — both fail, wrapped in a single ONE_OF_FAILED group
await credentials.run({ email: 'not-an-email' });
```

## Output shape on failure

```typescript
import { isValidupError, IssueCode, isIssueGroup } from 'validup';

try {
    await credentials.run({ email: 'x', phone: 'y' });
} catch (e) {
    if (isValidupError(e)) {
        const root = e.issues[0];
        if (isIssueGroup(root) && root.code === IssueCode.ONE_OF_FAILED) {
            console.log('All branches failed:', root.issues);
        }
    }
}
```

The wrapping group has `path: []` (because the failure is at the container level, not at a specific field).

## Combining with non-oneOf siblings

`oneOf` is a property of the **container**, not of individual mounts. To mix "must always validate" with "one-of these alternatives", nest a `oneOf` container inside a regular one:

```typescript
const credentials = new Container({ oneOf: true });
credentials.mount('email', isEmail);
credentials.mount('phone', isPhone);

const signin = new Container<{ password: string }>();
signin.mount('password', isStrongPassword);
signin.mount(credentials); // mount the one-of branch at root
```

Now `password` is required, and at least one of `email`/`phone` must validate.
