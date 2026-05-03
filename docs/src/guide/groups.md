# Groups

`group` lets you run **different validations on the same container** depending on what the call is doing. The classic case: `create` requires a password, `update` doesn't.

## Mount-time `group`

```typescript
const user = new Container<{ name: string; email: string; password: string }>();

user.mount('name',     isString);
user.mount('email',    isEmail);
user.mount('password', { group: ['create'] }, isStrongPassword);
```

A mount with `group` only runs when:

- `options.group` matches one of the mount's groups, **or**
- the mount's group includes `'*'` (wildcard), **or**
- the run was started with `group: '*'` (wildcard at the run level forces every mount to run).

Mounts with **no `group` declared** run for every group, including the default (no group) call.

## Run-time `group`

```typescript
await user.run(input, { group: 'create' });
// → name, email, password all run

await user.run(input, { group: 'update' });
// → name, email run; password is skipped

await user.run(input);
// → name, email run; password is skipped (no group ⇢ no match)

await user.run(input, { group: '*' });
// → every mount runs regardless of declared group
```

## Multiple groups per mount

```typescript
user.mount('twoFactorCode', { group: ['create', 'verify'] }, isCode);
```

The mount runs when the active `group` is `'create'` **or** `'verify'`.

## Combining with paths

Groups and paths are independent — both filters must let the mount through. A common pattern is an `update` group that explicitly **omits** required fields by not registering them under that group:

```typescript
class UserContainer extends Container<{ name: string; email: string; password: string }> {
    protected initialize() {
        // Required for both create and update
        this.mount('name',  isString);
        this.mount('email', isEmail);

        // Required only for create
        this.mount('password', { group: ['create'] }, isStrongPassword);

        // Optional patch fields, only on update
        this.mount('avatarUrl', { group: ['update'], optional: true }, isUrl);
    }
}
```

## Wildcard semantics

| Combination                          | Behavior                                                      |
|--------------------------------------|---------------------------------------------------------------|
| Mount has no `group`                 | Runs for every group (including no group)                     |
| Mount group `['create']`             | Runs only when run group is `'create'` (or `'*'`)             |
| Mount group `['*']`                  | Runs for every group                                          |
| Run group `'*'`                      | Forces every mount to run, ignoring its declared group        |
| Run group `undefined`                | Only mounts without a group declaration run                   |
