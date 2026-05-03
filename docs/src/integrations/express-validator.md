# @validup/express-validator

Wrap an [express-validator](https://express-validator.github.io) chain as a validup `Validator` and run it inside a `Container` — without rewriting the chain.

```bash
npm install @validup/express-validator validup express-validator --save
```

| Peer dependency      | Supported versions |
|----------------------|--------------------|
| `express-validator`  | `^7.3.1`           |

## Quick start

```typescript
import { Container, isValidupError } from 'validup';
import { createValidationChain, createValidator } from '@validup/express-validator';

const user = new Container<{ email: string; age: number }>();

user.mount('email', createValidator(() => createValidationChain().isEmail()));
user.mount('age',   createValidator(() => createValidationChain().isInt({ min: 0 })));

try {
    await user.run({ email: 'peter@example.com', age: 28 });
} catch (e) {
    if (isValidupError(e)) console.log(e.issues);
}
```

The adapter runs the chain as a `ContextRunner` against `{ body: ctx.value }`, then translates the resulting `ValidationError` (`field`, `alternative`, `alternative_grouped`) into validup issues. Sanitizers in the chain (`.toInt()`, `.trim()`, …) carry through to the validup output.

## `createValidationChain()`

`createValidationChain()` is a parameterless helper that returns express-validator's `body()` chain — pre-bound to read the value validup hands the validator. The chain is **not** keyed on the mount path; the field isolation is already done by the `Container` mount, so the chain just operates on the value as the entire body.

```typescript
import { createValidationChain, createValidator } from '@validup/express-validator';

container.mount(
    'tags',
    createValidator(() => createValidationChain().isArray({ min: 1, max: 10 })),
);
```

## Subclassing pattern

The dominant pattern is to subclass `Container<T>` and register chains inside `initialize()`:

```typescript
import { Container } from 'validup';
import { createValidationChain, createValidator } from '@validup/express-validator';

type User = { name: string; age: number; password: string };

class UserValidator extends Container<User> {
    protected override initialize() {
        super.initialize();

        this.mount('name', createValidator(() => createValidationChain()
            .exists()
            .notEmpty()
            .isLength({ min: 3, max: 128 })));

        this.mount('age', createValidator(() => createValidationChain()
            .isNumeric()
            .optional({ values: 'null' })));

        this.mount('password', createValidator(() => createValidationChain()
            .isLength({ min: 3, max: 128 })));
    }
}
```

## Per-context chains

Pass a function to `createValidator` to switch chains based on the validator context (group, sibling values, `ctx.context`):

```typescript
import { createValidationChain, createValidator } from '@validup/express-validator';

const tagsValidator = createValidator((ctx) => {
    const chain = createValidationChain().isArray({ min: 1, max: 10 });
    return ctx.group === 'optional' ? chain.optional({ values: 'null' }) : chain;
});

container.mount('tags', { group: 'required' }, tagsValidator);
container.mount('tags', { group: 'optional' }, tagsValidator);
```

## API

| Export                       | Description                                                                  |
|------------------------------|------------------------------------------------------------------------------|
| `createValidator(input)`     | Wrap a `ContextRunner` (or `(ctx) => ContextRunner`) as a validup `Validator`. |
| `createValidationChain()`    | Return a fresh `body()` chain pre-bound for use with the adapter (parameterless). |
| `buildIssuesForErrors(errors)` | Convert an array of express-validator `ValidationError`s into validup `Issue`s. |

```typescript
function createValidator<C = unknown>(
    input: ContextRunner | ((ctx: ValidatorContext<C>) => ContextRunner),
): Validator<C>;

function createValidationChain(): ValidationChain;
```
