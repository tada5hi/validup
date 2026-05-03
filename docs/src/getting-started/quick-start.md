# Quick Start

A `Container` holds a list of **mounts**. Each mount pairs a path (e.g. `'email'`, `'user.address.city'`, `'tags[*]'`) with a `Validator` function. Calling `container.run(data)` walks the mounts in order, expands paths, runs every validator, and either returns the typed output or throws a `ValidupError`.

## A minimal container

```typescript
import { Container, type Validator } from 'validup';

const isString: Validator = ({ value, key }) => {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${key} must be a non-empty string.`);
    }
    return value;
};

const isEmail: Validator = ({ value, key }) => {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error(`${key} must look like an email address.`);
    }
    return value;
};

const signup = new Container<{ name: string; email: string }>();
signup.mount('name', isString);
signup.mount('email', isEmail);

const data = await signup.run({
    name: 'Peter',
    email: 'peter@example.com',
});
// data is typed { name: string; email: string }
```

## Handling errors

`run()` throws a `ValidupError` whose `.issues` is the structured list of failures. Use the `isValidupError` duck-type guard rather than `instanceof` — it works across realm boundaries (e.g. multiple bundled copies of the package).

```typescript
import { isValidupError } from 'validup';

try {
    await signup.run({ name: '', email: 'not-an-email' });
} catch (error) {
    if (isValidupError(error)) {
        for (const issue of error.issues) {
            console.error(issue.path.join('.'), '→', issue.message);
        }
    }
}
```

## Avoiding throws: `safeRun`

If you'd rather branch on a result than catch, use `safeRun()` which returns a discriminated `Result<T>`:

```typescript
const result = await signup.safeRun({ name: '', email: 'x' });
if (result.success) {
    console.log(result.data);
} else {
    console.log(result.error.issues);
}
```

There is also a `safeRunSync()` for synchronous validator graphs (useful in reactive UIs that need to update without a `pending` flicker). See [Run Modes](/guide/run-modes).

## Going further

- [Guide → Container](/guide/container) — every mount option, in detail.
- [Guide → Issues & Errors](/guide/issues) — the structured `Issue` model.
- [Integrations → Zod](/integrations/zod) — wrap an existing zod schema as a validator.
