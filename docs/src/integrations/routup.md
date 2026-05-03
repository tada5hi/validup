# @validup/routup

Run a validup `Container` against a [routup](https://routup.net) HTTP request — body, cookies, params, or query.

```bash
npm install @validup/routup validup routup @routup/basic --save
```

| Peer dependency  | Supported versions |
|------------------|--------------------|
| `validup`        | (any)              |
| `routup`         | (peer)             |
| `@routup/basic`  | (peer)             |

## Quick start

```typescript
import { Container } from 'validup';
import { RoutupContainerAdapter } from '@validup/routup';

const user = new Container<{ email: string; password: string }>();
user.mount('email',    isEmail);
user.mount('password', isStrongPassword);

const adapter = new RoutupContainerAdapter(user);

// Inside a routup handler
async function login(req: Request) {
    const data = await adapter.run(req);
    // data is typed { email: string; password: string }
}
```

By default `run(req)` reads from the request **body**. Pass `options.locations` (an array — order matters) to read from somewhere else, or to try multiple locations in turn.

## Locations

```typescript
import { Location } from '@validup/routup';

await adapter.run(req, { locations: [Location.QUERY] });
await adapter.run(req, { locations: [Location.PARAMS, Location.QUERY, Location.BODY] });
```

| `Location` | Reads from   |
|------------|--------------|
| `BODY`     | `req.body` (default) |
| `COOKIES`  | `req.cookies`        |
| `PARAMS`   | `req.params`         |
| `QUERY`    | `req.query`          |

The adapter walks `locations` in order, tries the container against each one, and returns the **first** that succeeds. If every location fails:

- if any of them threw a `ValidupError`, the **last** one is re-thrown;
- otherwise an empty `ValidupError([])` is thrown.

Non-validup throws from a location attempt are swallowed in favour of trying the next location.

## Forwarded options

`RoutupContainerRunOptions<T, C>` extends `ContainerRunOptions<T, C>`, so:

- `signal` — propagates as the run-level abort signal
- `context` — flows into every validator's `ctx.context`
- `parallel` — switches the underlying container to parallel execution
- `group`, `pathsToInclude`, `pathsToExclude` — work as on a regular `Container.run()`

```typescript
const controller = new AbortController();
req.on('aborted', () => controller.abort());

await adapter.run(req, {
    locations: [Location.BODY],
    group: 'create',
    context: { db, user: req.user },
    signal: controller.signal,
});
```

## API

| Export                                    | Description                                                                                  |
|-------------------------------------------|----------------------------------------------------------------------------------------------|
| `RoutupContainerAdapter<T, C>`            | Wraps a `Container` and exposes `run(req, options?)`.                                        |
| `Location`                                | Enum: `BODY`, `COOKIES`, `PARAMS`, `QUERY`.                                                  |
| `RoutupContainerRunOptions<T, C>`         | Extends `ContainerRunOptions<T, C>` with `locations?: Location[]` (default `[Location.BODY]`). |
