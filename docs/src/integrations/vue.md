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

## Public shape

```typescript
type ValidupComposable<T> = {
    $invalid: ComputedRef<boolean>;
    $pending: ComputedRef<boolean>;
    $dirty:   ComputedRef<boolean>;
    $errors:  ComputedRef<IssueItem[]>;       // dirty-gated leaf items
    $issues:  ComputedRef<Issue[]>;           // raw items + groups
    $crossCuttingErrors: ComputedRef<IssueItem[]>; // path-less issues, always visible
    $groupErrors: ComputedRef<IssueGroup[]>;  // ONE_OF_FAILED, etc.

    $touch:    () => void;
    $reset:    () => void;
    $validate: () => Promise<Result<T>>;
    setExternalIssues: (issues: Issue[]) => void;
    $getResultsForChild: <C>(name: string) => ValidupComposable<C> | undefined;

    fields: Record<string, FieldState<unknown>>;
};

type FieldState<V> = {
    $model:   WritableComputedRef<V>;
    $invalid: ComputedRef<boolean>;
    $pending: ComputedRef<boolean>;
    $dirty:   ComputedRef<boolean>;
    $errors:  ComputedRef<IssueItem[]>;       // dirty-gated
    $issues:  ComputedRef<Issue[]>;           // raw
    $touch:   () => void;
    $reset:   () => void;
};
```

`v.fields.<key>` is a Proxy — reading any string key (including dotted paths like `'address.city'`) builds a `FieldState` lazily and caches it.

## Options

```typescript
type ValidupComposableOptions<T, C> = {
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

## Nested forms

```typescript
const parent = useValidup(parentContainer, parentState);
const child  = useValidup(childContainer,  childState, { name: 'address' });

// Inside parent's submit handler:
const childResult = parent.$getResultsForChild<AddressShape>('address');
```

`$getResultsForChild(name)` returns the child composable (or `undefined`). Nested forms register/unregister via Vue's `provide` / `inject`; `stopPropagation` and `detached` opt out of the registration to keep composables invisible to ancestors and/or descendants.

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
