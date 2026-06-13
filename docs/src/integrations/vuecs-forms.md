---
outline: deep
---

# Pairing with @vuecs/forms

[`@vuecs/forms`](https://github.com/tada5hi/vuecs) (5.x) ships a form-group wrapper, `<VCFormGroup>`, whose `:validation` prop drives message rendering **and** severity styling (input border / focus ring) from a single bundle. You don't talk to its internal `<VCValidationGroup>` directly anymore — `<VCFormGroup :validation>` is the canonical integration point.

The bundle that prop expects — `{ severity, messages, issues }` — is produced for you by [`@ilingo/validup-vue`](https://www.npmjs.com/package/@ilingo/validup-vue)'s `useFieldValidation()` (or the renderless `<IFieldValidation>`), which translates a `@validup/vue` field's `$errors` and resolves its `getSeverity`. So the three packages layer cleanly:

```
@validup/vue        →  @ilingo/validup-vue      →  @vuecs/forms
reactive $errors /     translate + bundle into     <VCFormGroup :validation>
getSeverity            FieldValidation             renders messages + paints severity
```

`@validup/vue` stays UI-free (it's `vue`-only); the i18n + presentational bridge lives in `@ilingo/validup-vue`; `@vuecs/forms` owns the rendering. Nothing in `@validup/vue` knows about either of the others.

## Install & setup

```bash
npm install @validup/vue @ilingo/validup-vue @ilingo/validup @ilingo/vue ilingo @vuecs/forms vue
```

`@ilingo/validup-vue` registers its catalog onto the `Ilingo` instance installed by `@ilingo/vue`, so **install order matters — `@ilingo/vue` first**:

```typescript
import { createApp } from 'vue';
import { install as installIlingo } from '@ilingo/vue';
import { install as installIlingoValidup } from '@ilingo/validup-vue';
import App from './App.vue';

const app = createApp(App);
installIlingo(app, { locale: 'en' });
installIlingoValidup(app); // looks up the Ilingo from @ilingo/vue
app.mount('#app');
```

Calling `installIlingoValidup` without a pre-installed `Ilingo` throws a pointed error rather than silently constructing a second instance the translation composables wouldn't see.

## The shipped pattern: `useFieldValidation` + `<VCFormGroup :validation>`

`useFieldValidation(field)` collapses the three reactive shims a per-field block used to need — severity, translated messages, and the `{ code, message }` → `{ key, value }` reshape — into one binding:

```vue
<script setup lang="ts">
import { reactive } from 'vue';
import { Container } from 'validup';
import { createValidator } from '@validup/zod';
import { useValidup } from '@validup/vue';
import { useFieldValidation } from '@ilingo/validup-vue';
import { VCFormGroup, VCFormInput } from '@vuecs/forms';
import { z } from 'zod';

class SignupValidator extends Container<{ email: string; password: string }> {
    protected override initialize() {
        super.initialize();
        this.mount('email', createValidator(z.string().email()));
        this.mount('password', createValidator(z.string().min(8)));
    }
}

const state = reactive({ email: '', password: '' });
const v = useValidup(new SignupValidator(), state);

const emailValidation = useFieldValidation(v.fields.email);
const passwordValidation = useFieldValidation(v.fields.password);
</script>

<template>
    <form>
        <VCFormGroup :validation="emailValidation">
            <VCFormInput v-model="v.fields.email.$model" />
        </VCFormGroup>

        <VCFormGroup :validation="passwordValidation">
            <VCFormInput v-model="v.fields.password.$model" type="password" />
        </VCFormGroup>
    </form>
</template>
```

::: warning Don't name the composable return `$v`
The `@ilingo/validup-vue` examples use `$v`, but a `$`-prefixed setup return crashes under Vue 3.5+ SSR (template identifiers starting with `$` skip the `setupState` lookup). Use `v` / `validation` instead — inner `$`-prefixed props (`v.$invalid`, `v.fields.email.$model`) are fine. See [@validup/vue → quick start](/integrations/vue#quick-start) and [#396](https://github.com/tada5hi/validup/issues/396).
:::

### Template-only with `<IFieldValidation>`

If you'd rather not declare each `useFieldValidation` call in `setup()`, the renderless `<IFieldValidation>` (shipped in `@ilingo/validup-vue@1.0.1`) owns the lifecycle for you and hands the bundle to its default slot as `value`:

```vue
<template>
    <IFieldValidation :field="v.fields.email" v-slot="{ value }">
        <VCFormGroup :validation="value">
            <VCFormInput v-model="v.fields.email.$model" />
        </VCFormGroup>
    </IFieldValidation>
</template>
```

Without a default slot it renders nothing.

## The `FieldValidation` bundle

`useFieldValidation` returns a **`reactive`** bundle — its keys auto-unwrap (and stay reactive) when bound onto `<VCFormGroup :validation>`:

```typescript
import type { Severity } from '@validup/vue';
import type { IssueTranslation, KeyValue } from '@ilingo/validup';

type FieldValidation = {
    severity: Severity;            // 'error' | 'warning' | 'success' | undefined
    messages: KeyValue<string>[];  // { key: issue.code ?? 'validation', value: message }[]
    issues: IssueTranslation[];    // raw translated issues — escape hatch for richer rendering
};
```

- **`severity`** is `getSeverity(field)` from `@validup/vue` — dirty / pending / optional aware. It is `undefined` while the field is pristine, `'warning'` for a pre-touch required-mount issue or an optional-mount-only failure, and `'error'` once a required-mount issue is touched. `@vuecs/forms` reads it to paint the field state.
- **`messages`** keys on the issue `code` (falling back to `'validation'`) so consumer-side selectors stay stable and don't churn with array indices.
- **`issues`** is the original `IssueTranslation[]` for consumers that want to render their own structure instead of the reshaped `messages`.

The severity union widened to include `'success'` (and the pristine `undefined`) — the old `'error' | 'warning'`-only contract is gone.

::: danger Call `useFieldValidation` in `setup()`, never inline in the template
Like every composable in `@ilingo/validup-vue` it wires a `computedAsync` watcher owned by the effect scope active at call time. From `setup()` that is the component scope — created once, disposed on unmount. Called **inline** in the template — `:validation="useFieldValidation(...)"` — there is no active scope on the render path, so it registers a fresh, never-disposed watcher on *every render* and hangs the page on typing ([@ilingo/validup-vue#965](https://github.com/tada5hi/ilingo/issues/965)). For template-only use, reach for `<IFieldValidation>` above — that's exactly what it exists for.
:::

## Severity flows down to the input

Wrapping the input in `<VCFormGroup :validation>` doesn't just render the message list — recent `@vuecs/forms` lets the form group push the resolved `severity` *down* to the wrapped control (via its `provideFormGroupContext`), so `<VCFormInput>` paints its border / focus ring red, amber, or green to match the field. Pristine (`severity: undefined`) leaves the control in its neutral state. The vuecs side of this contract is documented in the [validation feedback guide](https://vuecs.dev/guide/validation-feedback.html).

## Cross-cutting and group-level errors

`useValidup` exposes two collections that don't belong to a single field, so they don't go through `useFieldValidation`:

- **`v.$crossCuttingErrors`** — `IssueItem[]` with `path: []` (rate limits, CSRF, schema-level container failures). Render once near the form.
- **`v.$groupErrors`** — `IssueGroup[]` (e.g. `IssueCode.ONE_OF_FAILED` from a `oneOf` container). Each group carries its own `message` and a recursive `issues` list.

For a whole-form banner, translate the groups by their own code with `useTranslationsForGroupErrors` (it deliberately does **not** descend into per-branch leaves):

```vue
<script setup lang="ts">
import { useTranslationsForGroupErrors } from '@ilingo/validup-vue';

const groupErrors = useTranslationsForGroupErrors(v);
</script>

<template>
    <ul v-if="groupErrors.length">
        <li v-for="t in groupErrors" :key="t.issue.code">{{ t.message }}</li>
    </ul>
</template>
```

`<IValidup :composable="v">` (also from `@ilingo/validup-vue`) renders all three channels — cross-cutting, groups, and fields — each via its own named slot, when you want one component to cover the lot.

## Where to next

- [`@validup/vue`](/integrations/vue) — the composable that produces the reactive field state these bundles wrap.
- [`@validup/zod`](/integrations/zod) — the adapter used to mount the schema in the example above.
- [vuecs validation feedback guide](https://vuecs.dev/guide/validation-feedback.html) — the `<VCFormGroup>` / severity side, in detail.
