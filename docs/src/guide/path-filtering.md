# Path Filtering

`pathsToInclude` and `pathsToExclude` whittle down which mounts actually run. They're useful for partial updates (PATCH endpoints), or for re-using a Container in a context where some fields aren't applicable.

## Container-level vs run-level

Both options can be set on the container constructor and on each `run()` call. **Run-time options take precedence** over container-level options.

```typescript
const c = new Container<{ a: string; b: string; c: string }>({
    pathsToExclude: ['c'], // exclude 'c' for every run by default
});

c.mount('a', isString);
c.mount('b', isString);
c.mount('c', isString);

await c.run(input);
// → only mounts 'a' and 'b' run

await c.run(input, { pathsToInclude: ['a'] });
// → only 'a' runs (run-level overrides container-level)
```

## `pathsToInclude`

Whitelist mode. Only mounts whose expanded path matches the include list run.

```typescript
await c.run({ name: 'Peter', email: 'peter@example.com' }, {
    pathsToInclude: ['email'],
});
// → only 'email' is validated; 'name' is skipped
```

Use case: a PATCH endpoint that only validates the fields the client sent.

```typescript
function patchUser(req, res) {
    const sent = Object.keys(req.body);
    return userContainer.run(req.body, { pathsToInclude: sent });
}
```

## `pathsToExclude`

Blacklist mode. Mounts whose expanded path matches the exclude list are skipped.

```typescript
await c.run(input, { pathsToExclude: ['internalId'] });
```

Use case: re-using a server-side container on the client, where some fields (e.g. server-set IDs) shouldn't be validated.

## Nested containers

Both filters propagate down into nested containers. A child container receives the parent's filter (after the parent's prefix is stripped) so include/exclude lists work transparently across the tree.

```typescript
const address = new Container<{ city: string; zip: string }>();
address.mount('city', isString);
address.mount('zip',  isString);

const user = new Container<{ name: string; address: { city: string; zip: string } }>();
user.mount('name',    isString);
user.mount('address', address);

await user.run(input, { pathsToInclude: ['address.city'] });
// → 'name' is skipped, 'address.city' runs, 'address.zip' is skipped
```

## Path matching

Filters compare against the **expanded** path (the path after pathtrace globbing). For glob mounts (`'tags[*]'`), each expanded key is checked separately.

```typescript
container.mount('tags[*]', isTag);

await container.run({ tags: ['a', 'b', 'c'] }, {
    pathsToInclude: ['tags[1]'],
});
// → only tags[1] is validated
```
