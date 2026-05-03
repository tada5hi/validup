---
outline: deep
---

# Pairing with @vuecs/forms

[`@vuecs/forms`](https://github.com/tada5hi/vuecs) ships a small messages-only component, `<VCValidationGroup>`, that renders a list of validation messages with theming, severity, and slot-customizable item markup. It does **not** wrap the input itself — the input stays whatever you choose (`<VCFormInput>`, a plain `<input>`, anything).

`@validup/vue` produces those messages via `useValidup(...).fields.<key>.$errors`. The bridge between the two is a one-line adapter: map `IssueItem[]` → `ValidationMessages`.

> 🚧 **Coming soon.** `<VCValidationGroup>` is part of the unreleased `@vuecs/forms` line. The contract sketched below matches the current vuecs source but the published API may change.

## What `<VCValidationGroup>` expects

```typescript
type ValidationMessages =
    | Record<string, string>                    // record style — { key: message }
    | { key: string; value: string }[];         // array style

type ValidationSeverity = 'error' | 'warning';
```

Props (current vuecs `main`):

| Prop      | Type                  | Default   |
|-----------|-----------------------|-----------|
| `messages`| `ValidationMessages`  | `{}`      |
| `severity`| `ValidationSeverity`  | `'error'` |
| `itemTag` | `string`              | `'div'`   |

Slots: `default(props)` for full custom rendering, `item({ key, value, ... })` for per-message control. With no slots provided, each message is rendered as `<div class="form-group-hint group-required">{value}</div>`.

## What `useValidup` produces

```typescript
type IssueItem = {
    type: 'item';
    code: IssueCode | (string & {});
    path: PropertyKey[];
    message: string;
    received?: unknown;
    expected?: unknown;
    params?: Record<string, unknown>;
    meta?: Record<string, unknown>;
};

const v = useValidup(container, state);
v.fields.email.$errors.value; // IssueItem[] — dirty-gated leaves at this path
```

## Bridge: `messagesFromField()`

A 6-line adapter is enough. Use the issue `code` as the message key — that gives the consumer side stable selectors and avoids array-index churn when issues come and go:

```typescript
import type { IssueItem } from 'validup';

type ValidationMessages = Record<string, string>;

export function messagesFromField(items: IssueItem[]): ValidationMessages {
    const output: ValidationMessages = {};
    for (const item of items) {
        // `code` defaults to `IssueCode.VALUE_INVALID`; multiple issues with
        // the same code collapse to the *first* — fine for the common case
        // (one rule, one message). Use the array-style adapter below if you
        // need to surface every message.
        if (!(item.code in output)) {
            output[item.code] = item.message;
        }
    }
    return output;
}
```

If you want **every** message visible (one rule may produce several issues at the same path), use the array form so duplicate codes don't collapse:

```typescript
import type { IssueItem } from 'validup';

type ValidationMessage = { key: string; value: string };

export function messagesArrayFromField(items: IssueItem[]): ValidationMessage[] {
    return items.map((item, idx) => ({
        // Per-issue stable key: prefer `code`, fall back to index when several
        // issues share a code so Vue's keyed v-for stays well-defined.
        key: items.filter((j) => j.code === item.code).length > 1
            ? `${item.code}:${idx}`
            : item.code,
        value: item.message,
    }));
}
```

## Putting it together

```vue
<script setup lang="ts">
import { computed, reactive } from 'vue';
import { Container } from 'validup';
import { useValidup } from '@validup/vue';
import { VCFormInput, VCValidationGroup } from '@vuecs/forms';
import { messagesFromField } from './validup-vuecs-bridge';

const signup = new Container<{ email: string; password: string }>();
signup.mount('email', isEmail);
signup.mount('password', isStrongPassword);

const state = reactive({ email: '', password: '' });
const v = useValidup(signup, state, { debounce: 200 });

const emailMessages = computed(() => messagesFromField(v.fields.email.$errors.value));
const passwordMessages = computed(() => messagesFromField(v.fields.password.$errors.value));
</script>

<template>
    <form @submit.prevent="onSubmit">
        <VCFormInput v-model="v.fields.email.$model" placeholder="Email" />
        <VCValidationGroup :messages="emailMessages" />

        <VCFormInput v-model="v.fields.password.$model" type="password" />
        <VCValidationGroup :messages="passwordMessages" />

        <button :disabled="v.$invalid || v.$pending">Sign up</button>
    </form>
</template>
```

The composable owns *state* — `$model`, `$dirty`, `$pending`, `$errors`. The vuecs component owns *presentation* — theming, severity styling, item rendering. Neither package needs to know about the other.

## Severity mapping

`@validup/vue` already ships a per-field severity helper, [`getValidupSeverity`](/integrations/vue#severity), that returns `'success' | 'warning' | 'error' | undefined` based on `$dirty` / `$pending` / `$invalid`. `<VCValidationGroup>` only accepts `'error' | 'warning'`, so map the unsupported values to `undefined` (skip rendering):

```typescript
import { getValidupSeverity } from '@validup/vue';
import type { FieldState } from '@validup/vue';

function vcSeverity(field: FieldState<unknown>): 'error' | 'warning' | undefined {
    const sev = getValidupSeverity(field);
    return sev === 'error' || sev === 'warning' ? sev : undefined;
}
```

Then conditionally hide the group on `success`:

```vue
<VCValidationGroup
    v-if="vcSeverity(v.fields.email)"
    :severity="vcSeverity(v.fields.email)"
    :messages="emailMessages"
/>
```

## Cross-cutting and group-level errors

`useValidup` exposes two collections that don't belong to a single field:

- **`v.$crossCuttingErrors`** — `IssueItem[]` with `path: []` (rate limits, CSRF, schema-level container failures). Render once near the form, not per-field.
- **`v.$groupErrors`** — `IssueGroup[]` (e.g. `IssueCode.ONE_OF_FAILED` from a `oneOf` container). Each group has a `message` and a recursive `issues` list.

The same bridge works for both — flatten down to `IssueItem[]` first if you want a flat message list:

```typescript
import { flattenIssueItems } from 'validup';

const formMessages = computed(() => messagesFromField(
    flattenIssueItems([...v.$crossCuttingErrors.value, ...v.$groupErrors.value]),
));
```

```vue
<VCValidationGroup
    v-if="Object.keys(formMessages).length > 0"
    :messages="formMessages"
    severity="error"
/>
```

## Why not bundle the bridge in `@validup/vue`?

We considered it. The reason it stays out: `@validup/vue` has zero UI dependencies on purpose — it's `vue` only. Importing `@vuecs/forms` would pull in the entire vuecs theme + design-token machinery, which would break adopters who use `@validup/vue` with a different UI library (Vuetify, PrimeVue, Naive UI, plain HTML). The 6-line `messagesFromField` adapter is intentionally something you copy into your project — it lets you stay on whichever component library you're already shipping.

If you'd rather not write that adapter, file an issue once `@vuecs/forms` ships and we can publish a tiny `@validup/vuecs` companion package that does just this mapping.
