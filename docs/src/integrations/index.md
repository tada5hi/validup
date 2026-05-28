# Integrations Overview

validup keeps a pure-JS core. Integration packages bridge an existing validation library or a host framework into the `Container` / `Validator` / `Issue` model.

## Two shapes

**Validator adapters** expose a `createValidator()` function that returns a validup `Validator`:

```typescript
import { createValidator } from '@validup/zod';
import { z } from 'zod';

container.mount('email', createValidator(z.string().email()));
```

These come in three flavors today:

| Package                          | Wraps                                                   | Pick when…                                  |
|----------------------------------|---------------------------------------------------------|---------------------------------------------|
| [`@validup/standard-schema`](/integrations/standard-schema) | Any [Standard Schema](https://standardschema.dev) library (zod 3.24+, valibot, arktype, …) | You want vendor-neutral schemas |
| [`@validup/zod`](/integrations/zod)               | [zod](https://zod.dev) v4         | You need vendor-specific issue fields (`expected`, `received`) |
| [`@validup/validator-js`](/integrations/validator-js) | [validator.js](https://github.com/validatorjs/validator.js) string validators (`isEmail`, `isLength`, `isInt`, …) | You want pre-baked factories for the common rules with vocabulary codes baked in |

**Framework / runtime integrations** consume a whole `Container<T, C>` and wire it into a host environment:

| Package                             | Host                                       |
|-------------------------------------|--------------------------------------------|
| [`@validup/vue`](/integrations/vue) | [Vue 3](https://vuejs.org) reactive forms  |

## Writing your own

If you want to bridge another library, copy the shape of `@validup/zod`:

```typescript
import { type Validator, type ValidatorContext, ValidupError } from 'validup';

type CreateFn<C> = (ctx: ValidatorContext<C>) => Schema;

export function createValidator<C = unknown>(input: Schema | CreateFn<C>): Validator<C> {
    return async (ctx): Promise<unknown> => {
        const schema = typeof input === 'function' ? input(ctx) : input;
        const outcome = await schema.safeParseAsync(ctx.value);
        if (outcome.success) return outcome.data;
        throw new ValidupError(buildIssuesForError(outcome.error));
    };
}
```

Three contract points to preserve:

1. Accept either a schema or a `(ctx) => schema` factory.
2. Make `createValidator<C>` generic over the validup context.
3. Translate foreign errors into `Issue[]` using `defineIssueItem` / `defineIssueGroup` — never construct issue objects literally.

For framework integrations, study `@validup/vue` — a reactive composable that drives form state from `safeRun()`.
