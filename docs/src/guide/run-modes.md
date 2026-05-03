# Run Modes

`Container` exposes five entry points. They share the same options, mount semantics, and issue-handling, but differ in how they execute the mounts.

| Method                  | Returns                | Concurrency  | On per-mount throw                | When to pick                          |
|-------------------------|------------------------|--------------|-----------------------------------|---------------------------------------|
| `run(data, opts)`       | `Promise<T>`           | sequential   | collects, throws `ValidupError`   | default — most use cases              |
| `runSync(data, opts)`   | `T`                    | sequential   | collects, throws `ValidupError`   | reactive UIs that must not flicker pending |
| `run(.. parallel: true)`| `Promise<T>`           | parallel     | collects, throws `ValidupError`   | many independent async validators     |
| `safeRun(data, opts)`   | `Promise<Result<T>>`   | sequential   | returns `{ success: false, error }` | branch-on-result instead of try/catch |
| `safeRunSync(data, opts)`| `Result<T>`           | sequential   | returns `{ success: false, error }` | sync, branch-on-result                |

`Result<T> = { success: true; data: T } | { success: false; error: ValidupError }`.

## Sequential `run()`

The default. Walks mounts in registration order, awaits each one, and reads `value` from `output[key]` if a previous mount on the same path already wrote to it. This makes **sanitize-then-validate** chains work:

```typescript
container.mount('name', sanitizeName); // returns trimmed string
container.mount('name', isString);     // sees the trimmed value
```

## `runSync()`

Same loop without `await`. Validator return values must not be thenable; nested containers must implement `runSync`. Violations throw a `RunSyncViolationError` (use the duck-type guard `isRunSyncViolation`) — these are **not** folded into the issue list, because they mean the caller can't use sync mode against this graph at all.

```typescript
const out = container.runSync(input); // throws on async validator
```

Pick this when you're driving a reactive UI and an `await` flicker would cause the form to show "pending" between every keystroke. The Vue composable in `@validup/vue` schedules with `safeRun()` (async) and uses `signal` for cancellation; sync mode is for cases where you control the validator graph end-to-end.

## Parallel `run({ parallel: true })`

Eagerly kicks off every mount's promise, then awaits via `Promise.allSettled`. Issues are merged in mount-registration order regardless of which validator rejects first.

```typescript
await container.run(input, { parallel: true });
```

**Trade-off:** parallel mode reads `value` from the input data only — it does **not** read sibling output. Sanitize-then-validate chains (where one mount transforms a value the next mount reads) only work in sequential mode.

Use parallel mode when:

- Most or all validators are independent async I/O (DB lookups, HTTP fan-out).
- You don't have any sanitize-then-validate chains on shared paths.

## Safe variants

`safeRun()` and `safeRunSync()` wrap their non-safe siblings:

```typescript
const result = await container.safeRun(input);
if (result.success) {
    handle(result.data);
} else {
    showErrors(result.error.issues);
}
```

Abort errors and `RunSyncViolationError`s are **not** wrapped — they propagate verbatim, since they're not validation outcomes. You'll still see them as a normal throw out of `safeRun`/`safeRunSync`.

## `flat: true`

By default the output is **expanded** from dotted keys back into a nested object. Pass `flat: true` to keep the dotted-key map (used internally for nested-container plumbing, occasionally useful at the boundary):

```typescript
const c = new Container<{ user: { name: string } }>();
c.mount('user.name', isString);

await c.run({ user: { name: 'Peter' } }, { flat: true });
// → { 'user.name': 'Peter' }
```
