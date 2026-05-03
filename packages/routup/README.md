# @validup/routup 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A [validup](https://www.npmjs.com/package/validup) integration for [routup](https://routup.net) — wire a `Container` into HTTP request validation.

Run a validup `Container` against a routup `Request`, picking up the input from the request body, query, params, or cookies — and falling through alternative locations until one validates.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Locations](#locations)
- [Multi-Location Fallback](#multi-location-fallback)
- [Groups](#groups)
- [Real-World Pattern](#real-world-pattern)
- [Error Handling](#error-handling)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install @validup/routup validup routup @routup/basic --save
```

| Peer dependency  | Supported versions |
|------------------|--------------------|
| `validup`        | `^0.2.2`           |
| `routup`         | `^4.1.0`           |
| `@routup/basic`  | `^1.4.3`           |

## Quick Start

```typescript
import { Router, coreHandler } from 'routup';
import { basic } from '@routup/basic';
import { Container, ValidupError } from 'validup';
import { RoutupContainerAdapter } from '@validup/routup';

const tokenContainer = new Container<{ token: string }>();
tokenContainer.mount('token', ({ value }) => {
    if (typeof value !== 'string') throw new Error('token must be a string');
    return value;
});

const router = new Router();
router.use(basic({ body: true }));

router.post('/login', coreHandler(async (req) => {
    const adapter = new RoutupContainerAdapter(tokenContainer);
    const { token } = await adapter.run(req);
    return { token };
}));
```

By default the adapter pulls input from the **request body**. Use the `locations` option to read elsewhere or to define a fallback list.

## Locations

`Location` enumerates every supported request source:

| `Location` | Source                      | Reader                                |
|------------|-----------------------------|---------------------------------------|
| `body`     | request body                | `useRequestBody(req)` from `@routup/basic/body` |
| `cookies`  | cookies                     | `useRequestCookies(req)` from `@routup/basic/cookie` |
| `query`    | query string                | `useRequestQuery(req)` from `@routup/basic/query` |
| `params`   | path parameters             | `useRequestParams(req)`               |

```typescript
import { Location } from '@validup/routup';

await adapter.run(req, { locations: [Location.QUERY] });
await adapter.run(req, { locations: ['cookies'] });            // string literal also works
await adapter.run(req, { locations: ['params'] });
```

Make sure the corresponding `@routup/basic` middleware is enabled for each location you read from (e.g. `basic({ query: true, cookie: true })`).

## Multi-Location Fallback

Pass multiple locations to try them in order. The first one that produces a value the container accepts wins. If every location fails, the **last** `ValidupError` is thrown.

```typescript
const adapter = new RoutupContainerAdapter(tokenContainer);

const { token } = await adapter.run(req, {
    locations: ['body', 'query', 'cookies'],
});
// → tries body, then query, then cookies
```

This is useful for endpoints that accept the same payload from different transports — e.g. a token that may arrive in the body on POST, in the query on GET, or in a cookie on browser navigation.

## Groups

`run()` forwards every option that `Container.run` understands — so you can drive a single validator with `create` / `update` semantics straight from the HTTP layer:

```typescript
const adapter = new RoutupContainerAdapter(new RoleValidator());

router.post('/roles',     coreHandler(async (req) => adapter.run(req, { group: 'create' })));
router.patch('/roles/:id', coreHandler(async (req) => adapter.run(req, { group: 'update' })));
```

## Real-World Pattern

In practice you typically pair this adapter with a subclassed `Container` validator (see [validup's subclassing pattern](https://www.npmjs.com/package/validup#subclassing)). The result is a controller that stays thin while validation rules live next to the entity they describe:

```typescript
import { RoutupContainerAdapter } from '@validup/routup';
import { IdentityProviderValidator, IdentityProviderAttributesValidator } from './validators';

router.post('/identity-providers', coreHandler(async (req) => {
    const data = await new RoutupContainerAdapter(new IdentityProviderValidator())
        .run(req, { group: 'create' });

    const attributes = await new RoutupContainerAdapter(new IdentityProviderAttributesValidator())
        .run(req);

    return repository.create({ ...data, attributes });
}));
```

## Error Handling

The adapter throws a `ValidupError` whenever every configured location fails. Use `validup`'s structured `issues` to render field-level error responses:

```typescript
import { isValidupError } from 'validup';

router.use((err, req, res, next) => {
    if (isValidupError(err)) {
        res.status(400).send({
            message: err.message,
            issues: err.issues,
        });
        return;
    }
    next(err);
});
```

If no location yielded a `ValidupError` (e.g. all fell through silently), the adapter throws an empty `ValidupError([])` — so callers always handle a single error type.

## API Reference

```typescript
class RoutupContainerAdapter<T extends ObjectLiteral = ObjectLiteral, C = unknown> {
    constructor(container: Container<T, C>);

    run(req: Request, options?: RoutupContainerRunOptions<T, C>): Promise<T>;
}

type RoutupContainerRunOptions<T, C = unknown> = ContainerRunOptions<T, C> & {
    locations?: ('body' | 'cookies' | 'params' | 'query')[]; // default: ['body']
};

enum Location {
    BODY    = 'body',
    COOKIES = 'cookies',
    PARAMS  = 'params',
    QUERY   = 'query',
}
```

| Export                       | Description                                                |
|------------------------------|------------------------------------------------------------|
| `RoutupContainerAdapter`     | Class — wraps a `Container` for use against a routup `Request`. |
| `Location`                   | Enum of supported request sources.                         |
| `RoutupContainerRunOptions`  | Type — `ContainerRunOptions` extended with `locations`.    |

## License

Made with 💚

Published under [MIT License](./LICENSE).

[npm-version-src]: https://badge.fury.io/js/@validup%2Froutup.svg
[npm-version-href]: https://npmjs.com/package/@validup/routup
[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org
