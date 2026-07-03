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

## Strict mode (`pathsStrict`)

By default, an include/exclude entry that matches **no mount** is silently ignored — the run just executes fewer mounts. That's convenient, but it hides a real failure mode: if a shared validator renames a mounted key out from under a caller's static path list (`client_id` → `clientId`), the scoped validation for that field silently disappears instead of failing.

`pathsStrict: true` makes the container **fail loud**. Before running any validator, it verifies every resolved `pathsToInclude` / `pathsToExclude` entry is satisfied (an exact key match, or a prefix descent into a container mount). Any entry that matches nothing throws a structural `PathsStrictViolationError` listing the unmatched (absolute) paths.

```typescript
import { PathsStrictViolationError, isPathsStrictViolation } from 'validup';

const c = new Container<{ client_id: string }>();
c.mount('client_id', isString);

try {
    await c.run(input, {
        pathsToInclude: ['clientId'], // typo / renamed key
        pathsStrict: true,
    });
} catch (e) {
    if (isPathsStrictViolation(e)) {
        e.pathsToInclude; // → ['clientId']
        e.pathsToExclude; // → []
    }
}
```

It can be set container-wide too; the per-run option wins:

```typescript
new Container({ pathsToInclude: ['client_id'], pathsStrict: true });
```

Details:

- **Structural, not a validation failure.** Like a `runSync` violation, the error is re-thrown verbatim — `safeRun` / `safeRunSync` do **not** wrap it into a `Result.failure`. It signals a misconfigured validator graph, not bad input.
- **Nested containers self-check.** The flag threads into keyed child `run()` calls alongside the already-stripped filter lists, so a renamed *child* mount (`address.zip` → `address.postal`) is caught inside the child and reported with its absolute path (`address.zip`).
- **Group filtering stays orthogonal.** A mount excluded from the active `group` still exists, so a valid path targeting it does not trip strict mode.
- **Keyless container mounts are a blind spot.** A keyless child shares the parent's namespace, so the parent can't tell whether an unmatched path belongs to that child or is genuinely stale — it defers (never throws) and does *not* forward strict into the keyless child (doing so would false-positive on the parent's own sibling paths). Paths only reachable through a keyless container are therefore not strict-checked.
- **Globs are matched against expanded keys.** A data-dependent glob mount (`items.*`, `**.email`) only expands for the keys present in the input. Pairing such a mount with an index-specific include (`items[0]`) under strict mode can throw when the array is empty — the key genuinely didn't expand for that run. Static keys expand literally (independent of the data), so the common flat-entity case is unaffected.
- Both `pathsToInclude` and `pathsToExclude` are checked under the same flag.
