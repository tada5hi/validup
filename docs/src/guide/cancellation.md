# Cancellation

Pass an `AbortSignal` to `run()` (or any sibling) and validup will:

1. **Pre-mount abort check** — `signal.throwIfAborted()` runs before each mount, so a cancelled run short-circuits cleanly without entering the per-mount try/catch.
2. **Forward the signal to validators** — `ctx.signal` is set so async validators can pass it to `fetch` / DB clients.
3. **Propagate the abort** — if a validator throws an abort error mid-flight, validup re-throws verbatim instead of folding it into the issue list.

## Example

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(new Error('user cancelled')), 5000);

try {
    await container.run(input, { signal: controller.signal });
} catch (e) {
    if (controller.signal.aborted) {
        // run was cancelled — `e` is the abort reason, NOT a ValidupError
    }
}
```

## Validators that respect cancellation

```typescript
const fetchProfile: Validator = async ({ value, signal }) => {
    const r = await fetch(`/profile/${value}`, { signal });
    return r.json();
};
```

Forwarding the signal is what makes cancellation actually save work — without it the validator runs to completion even after the controller fires.

## `safeRun` and abort

`safeRun()` does **not** wrap abort errors as a `Result.failure`. Doing so would produce a misleading "AbortError" issue at path `[]`. Aborts re-throw out of `safeRun`/`safeRunSync` — handle them with try/catch around the call.

```typescript
try {
    const result = await container.safeRun(input, { signal });
    if (result.success) handle(result.data);
    else showErrors(result.error.issues);
} catch (e) {
    if (signal.aborted) return; // bow out silently
    throw e;
}
```

## In `@validup/vue`

The Vue composable wires this up automatically: each scheduled run owns an `AbortController`; whenever state, group, or context changes, the in-flight controller aborts and a fresh one starts. `$validate()` deliberately runs **without** a signal so an explicit submit-time check can't be stomped by an intervening keystroke.

See [@validup/vue](/integrations/vue) for the full composable shape.
