# @validup/vue

A Vue 3 composable — `useValidup(container, state, options?)` — that turns any validup `Container` into a [vuelidate](https://vuelidate-next.netlify.app/)-shaped reactive form state object.

```bash
npm install @validup/vue validup vue --save
```

| Peer dependency | Supported versions |
|-----------------|--------------------|
| `vue`           | `^3.3`             |

## Quick start

```vue
<script setup lang="ts">
import { reactive } from 'vue';
import { Container } from 'validup';
import { useValidup } from '@validup/vue';

const signup = new Container<{ email: string; password: string }>();
signup.mount('email',    isEmail);
signup.mount('password', isStrongPassword);

const state = reactive({ email: '', password: '' });
const v = useValidup(signup, state, { debounce: 200 });

async function submit() {
    const result = await v.$validate();
    if (result.success) {
        await save(result.data);
    }
}
</script>

<template>
    <form @submit.prevent="submit">
        <input v-model="v.fields.email.$model" :class="{ invalid: v.fields.email.$dirty && v.fields.email.$invalid }" />
        <p v-if="v.fields.email.$errors[0]">{{ v.fields.email.$errors[0].message }}</p>

        <input v-model="v.fields.password.$model" type="password" />
        <p v-if="v.fields.password.$errors[0]">{{ v.fields.password.$errors[0].message }}</p>

        <button :disabled="v.$invalid || v.$pending">Sign up</button>
    </form>
</template>
```

::: warning Vue 3.5+ SSR gotcha — don't name the setup return `$v`
Vue 3.5's [`PublicInstanceProxyHandlers.get`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/componentPublicInstance.ts) treats every template identifier starting with `$` as a Vue built-in lookup, skipping the `setupState` resolution chain. `$v` is not in Vue's allowlist (`$attrs`, `$emit`, `$props`, `$refs`, …), so a template that reads `$v.fields.X` resolves `$v` to `undefined` and crashes at first SSR render with `Cannot read properties of undefined`. `vue-tsc` does not flag this. Use `v`, `validation`, or any non-`$`-prefixed name — inner `$`-prefixed properties (`v.$invalid`, `v.fields.name.$model`) are fine. See [#396](https://github.com/tada5hi/validup/issues/396).
:::

## Public shape

```typescript
type Composable<T> = {
    $invalid: ComputedRef<boolean>;
    $pending: ComputedRef<boolean>;
    $dirty:   ComputedRef<boolean>;
    $errors:  ComputedRef<IssueItem[]>;       // visible leaf items (see Severity)
    $issues:  ComputedRef<Issue[]>;           // raw items + groups
    $crossCuttingErrors: ComputedRef<IssueItem[]>; // path-less issues, always visible
    $groupErrors: ComputedRef<IssueGroup[]>;  // ONE_OF_FAILED, etc.

    $touch:    () => void;
    $reset:    () => void;
    $validate: () => Promise<Result<T>>;
    setExternalIssues: (issues: Issue[]) => void;
    $getResultsForChild: <C>(name: string) => Composable<C> | undefined;

    fields: Record<string, FieldState<unknown>>;
};

type FieldState<V> = {
    $model:   WritableComputedRef<V>;
    $invalid: ComputedRef<boolean>;
    $pending: ComputedRef<boolean>;
    $dirty:   ComputedRef<boolean>;
    $errors:  ComputedRef<IssueItem[]>;       // required-mount items show immediately; optional-mount items wait for $dirty
    $issues:  ComputedRef<Issue[]>;           // raw
    $touch:   () => void;
    $reset:   () => void;
};
```

`v.fields.<key>` returns a `FieldState<T[K]>` for top-level entity keys — strict-mode TypeScript clean (no `| undefined` from an index-signature fallback), so templates don't need a non-null assertion on every reference. For dotted (`'user.email'`), bracketed (`'tags[0]'`), or runtime-computed paths, use `v.fields.at(path)`:

```typescript
v.fields.at('user.email').$model.value = 'peter@example.com';
v.fields.at('tags[0]').$model.value = 'urgent';
```

A field literally named `at` is shadowed by the dynamic accessor — reach it via `v.fields.at('at')` if needed.

The `state` argument is typed as `Partial<T>`, so a form that only carries a subset of the validator's entity (e.g. a `Container<User>` driving a create form of `{ name, email }` where `id` / `createdAt` are server-set) type-checks without an `as any` cast. `T` stays bound to the container's entity type, so typed-field access still narrows against the full entity.

## Options

```typescript
type ComposableOptions<T, C> = {
    group?: MaybeRef<string>;
    debounce?: number;            // ms — schedule next run after debounce idle
    name?: string;                // register with parent composable under this name
    stopPropagation?: boolean;    // skip inject() — stay invisible to ancestors
    detached?: boolean;           // skip BOTH inject() and provide() — fully invisible
    lazy?: boolean;               // skip the on-mount probe; first $model write triggers validation
    autoDirty?: boolean;          // mark every state key dirty whenever state changes
    scope?: string;               // scoped parent/child injection key
    context?: MaybeRef<C>;
};
```

## Cancellation, debounce, and `$validate`

- Each scheduled run owns an `AbortController`. When state, group, or context changes, the in-flight controller aborts and a new one starts.
- `debounce` collapses rapid keystrokes into one run (using the latest state).
- `$validate()` deliberately runs **without a signal** so a submit-time check can't be aborted by an intervening keystroke.

## Result caching (automatic)

`useValidup` owns a [`ResultCache`](/guide/caching) per composable scope and passes it on every `safeRun` call. The practical effect:

- **Per-keystroke runs** only invoke mounts whose `(value, context, group)` snapshot changed. A user editing the `name` field doesn't re-run `email`, `password`, etc. — their cached outcomes replay.
- **Submit (`$validate()`)** reuses everything the scheduled runs already proved fresh, so async validators (uniqueness checks, captcha verifies) don't fire again unless their inputs actually changed.

The cache is cleared automatically when:

- `$reset()` is called — the form returns to a clean state, so the next run hits every validator fresh.
- The container reference swaps (e.g. you `ref()` a container that gets reassigned) — old mount identities become unreachable; the new container starts cold.

Cross-field validators must declare themselves with `sideEffect: true` (via `defineValidator` or the adapter's `{ sideEffect: true }` option) so they re-run when a sibling changes. `@validup/validator-js`'s `equals(key)` (no `expectedValue`) does this automatically; see [Caching](/guide/caching#opting-out-sideeffect) for the full contract.

## Nested forms

```typescript
// ParentForm.vue — the aggregation root
const parent = useValidup(parentContainer, parentState, { stopPropagation: true });

// reactive — re-evaluates when the section registers/unregisters
const address = computed(() => parent.$getResultsForChild<AddressShape>('address'));
```

```typescript
// AddressSection.vue — a child COMPONENT rendered by ParentForm.vue
const child = useValidup(childContainer, childState, { name: 'address' });
```

`$getResultsForChild(name)` returns the child composable (or `undefined`). Nested forms register/unregister via Vue's `provide` / `inject`; `stopPropagation` and `detached` opt out of the registration to keep composables invisible to ancestors and/or descendants.

::: warning Parent and child must live in different components
Vue's `inject()` only resolves values provided by **ancestor components** — a component never sees its own `provide()`. Two `useValidup()` calls in the same `<script setup>` therefore never link; the child has to be a real child component of the one that owns the parent composable.
:::

The child registry is `shallowReactive`, so `$getResultsForChild` works **reactively** too: a template binding or `computed` over it re-evaluates when the child registers/unregisters, and tracking continues through the returned composable's refs (`$invalid`, `$dirty`, …) for live parent-side aggregation — not just submit-time reads.

## External issues

Server-side validation can flow back into the same form via `setExternalIssues(issues)`. External issues are tagged with `meta.external = true` and clear automatically when the matching `$model` is rewritten.

```typescript
async function submit() {
    const result = await v.$validate();
    if (!result.success) return;
    try {
        await save(result.data);
    } catch (e) {
        if (isValidupError(e)) {
            v.setExternalIssues(e.issues);
        }
    }
}
```
