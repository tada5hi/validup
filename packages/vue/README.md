# @validup/vue 🛡️

[![npm version][npm-version-src]][npm-version-href]
[![Master Workflow][workflow-src]][workflow-href]
[![CodeQL][codeql-src]][codeql-href]
[![Known Vulnerabilities][snyk-src]][snyk-href]
[![Conventional Commits][conventional-src]][conventional-href]

A [validup](https://www.npmjs.com/package/validup) integration for [Vue 3](https://vuejs.org) — drive reactive form state from a `Container<T>`.

Drive form validation from a validup `Container<T>` with a vuelidate-shaped composable. The same validator runs on the **server** and the **client** — no rule duplication, no schema drift.

**Table of Contents**

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Real-World Pattern](#real-world-pattern)
- [Per-Field State](#per-field-state)
- [Nested Paths](#nested-paths)
- [Groups](#groups)
- [Optional Validation](#optional-validation)
- [Async & Debouncing](#async--debouncing)
- [Lazy Validation](#lazy-validation)
- [Auto-Dirty (External State Mutations)](#auto-dirty-external-state-mutations)
- [External (Server) Errors](#external-server-errors)
- [Cross-Cutting Errors](#cross-cutting-errors)
- [Nested Forms](#nested-forms)
  - [How Children Register](#how-children-register)
  - [Scoped Parent / Child Trees](#scoped-parent--child-trees)
  - [`stopPropagation` vs `detached`](#stoppropagation-vs-detached)
- [Severity](#severity)
- [API Reference](#api-reference)
- [Migrating from Vuelidate](#migrating-from-vuelidate)
- [Stability](#stability)
- [License](#license)

## Installation

```bash
npm install @validup/vue validup vue --save
```

| Peer dependency | Supported versions |
|-----------------|--------------------|
| `validup`       | `^1.0.0`           |
| `vue`           | `^3.3`             |

## Quick Start

```typescript
import { ref, reactive } from 'vue';
import { Container, ValidupError } from 'validup';
import { createValidator } from '@validup/zod';
import { useValidup, getSeverity } from '@validup/vue';
import { z } from 'zod';

const userValidator = new Container<{ name: string; email: string }>();
userValidator.mount('name',  createValidator(z.string().min(2)));
userValidator.mount('email', createValidator(z.string().email()));

export default {
    setup() {
        const form = reactive({ name: '', email: '' });
        const v = useValidup(userValidator, form);

        async function submit() {
            const result = await v.$validate();
            if (!result.success) return;
            // result.data: { name, email }
        }

        return { form, v, submit };
    },
};
```

In the template:

```vue
<input v-model="v.fields.name.$model" :class="getSeverity(v.fields.name)" />
<small v-for="err in v.fields.name.$errors" :key="err.code">{{ err.message }}</small>
```

> **⚠️ Don't name the setup return `$v` (Vue 3.5+ SSR gotcha).**
> Vue 3.5's [`PublicInstanceProxyHandlers.get`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/componentPublicInstance.ts) treats every template identifier starting with `$` as a Vue built-in lookup, skipping the `setupState` resolution chain entirely. `$v` isn't in Vue's built-in allowlist (`$attrs`, `$emit`, `$props`, `$refs`, …), so a template that reads `$v.fields.X` resolves `$v` to `undefined` and crashes at first SSR render with `Cannot read properties of undefined (reading 'fields')`. `vue-tsc` does not flag this — the source type-checks fine. Use `v`, `validation`, or any non-`$`-prefixed name. Inner `$`-prefixed properties (`v.$invalid`, `v.fields.name.$model`) are unaffected — only the **outer setup-return name** has to be `$`-free. See [#396](https://github.com/tada5hi/validup/issues/396) for the full diagnosis.

## Real-World Pattern

The dominant pattern is a subclassed `Container<T>` you can reuse on both server and client:

```typescript
// shared validator (server + client)
import { Container } from 'validup';
import { createValidator } from '@validup/zod';
import { z } from 'zod';

type Role = { name: string; description?: string };

export class RoleValidator extends Container<Role> {
    protected override initialize() {
        super.initialize();

        const nameValidator = createValidator(z.string().min(3).max(128));
        this.mount('name', { group: 'create' }, nameValidator);
        this.mount('name', { group: 'update', optional: true }, nameValidator);

        this.mount(
            'description',
            { optional: true },
            createValidator(z.string().max(4096).nullable()),
        );
    }
}
```

Then in any Vue form:

```typescript
import { reactive, ref } from 'vue';
import { useValidup } from '@validup/vue';
import { RoleValidator } from '@my-app/validators';

const form = reactive({ name: '', description: '' });
const group = ref<'create' | 'update'>('create');
const v = useValidup(new RoleValidator(), form, { group });
```

The `state` argument is typed as `Partial<T>`, so a form that only carries a subset of the validator's entity fields (e.g. a `Container<User>` against a `{ name, email }` create form where `id` / `createdAt` are server-set) type-checks without any cast. `T` stays bound to the container's entity type — typed-field access (`v.fields.name`) still narrows against the full entity, not the narrower form.

## Per-Field State

`v.fields.<key>` returns a `FieldState`. Top-level keys narrow to `FieldState<T[K]>` (strict-mode clean — never `| undefined`). For dotted / bracketed / runtime-computed paths use `v.fields.at('user.email')` — see [Nested Paths](#nested-paths) below.

| Member         | Type                                  | Description                                                          |
|----------------|---------------------------------------|----------------------------------------------------------------------|
| `$model`       | `WritableComputedRef<V>`              | Two-way bound to `state[<key>]`. Writing flips `$dirty` automatically (no-op writes don't). |
| `$invalid`     | `ComputedRef<boolean>`                | True iff one or more issues are at this path.                        |
| `$dirty`       | `ComputedRef<boolean>`                | True after `$touch()` or first non-no-op `$model` write.             |
| `$pending`     | `ComputedRef<boolean>`                | Form-level pending — true while *any* run is in flight. validup runs the whole container in one pass, so per-field pending is impossible. |
| `$errors`      | `ComputedRef<IssueItem[]>`            | Visible errors — gated on `$dirty`.                                  |
| `$issues`      | `ComputedRef<Issue[]>`                | Raw issues at or below this path (groups + items), regardless of dirty state. |
| `$touch()`     | `() => void`                          | Mark this field dirty.                                               |
| `$reset()`     | `() => void`                          | Clear dirty + drop any external issues for this path.                |

## Nested Paths

`fields.at(<path>)` accepts dotted, bracketed, or mixed paths — and any runtime-computed key:

```typescript
v.fields.at('user.email').$model.value = 'peter@example.com';
v.fields.at('tags[0]').$model.value = 'urgent';
v.fields.at('matrix[0].name').$model.value = 'first';
```

Why `at(...)` instead of bracket access? Under strict-mode TypeScript (`noUncheckedIndexedAccess`, the default for Nuxt and most modern setups) a string-keyed index signature returns `FieldState | undefined`, forcing a non-null assertion on every template reference. `fields.at(...)` keeps the typed-key path (`v.fields.name`) strict-mode clean *and* still gives you a dynamic accessor for paths the typed keys can't express. Caveat: a field literally named `at` is shadowed by the accessor — use `fields.at('at')` to reach it.

Touching an ancestor (`v.fields.user.$touch()`) surfaces every descendant error (`user.email`, `user.profile.bio`, …) — useful for "validate this whole section on submit" UX.

Object/array intermediates are auto-created on write, so writing `v.fields.at('address.city').$model.value = 'Berlin'` against `state = {}` produces `state.address = { city: 'Berlin' }`.

## Groups

Pass a reactive `group` to drive `'create'` / `'update'` (or any custom) validation modes from the same container:

```typescript
import { ref, reactive } from 'vue';

const group = ref<'create' | 'update'>('create');
const v = useValidup(new RoleValidator(), reactive({ name: '' }), { group });

// Switching groups re-validates the whole form eagerly.
// Per-field $errors stay quiet until that field is dirty.
group.value = 'update';
```

## Optional Validation

Optional mounts on the container behave the same way they do server-side — pass `{ optional: true }` to `Container.mount(...)` and the field is skipped when its value qualifies as missing. Without configuration, `@validup/vue` uses validup core's conservative defaults (`optionalValue: 'undefined'`, no `optionalAs`). To opt into a form-friendly app-wide idiom, install the plugin:

```typescript
import { createApp } from 'vue';
import { createValidup } from '@validup/vue';

const app = createApp(/* ... */);
app.use(createValidup({
    // Treat both `undefined` AND empty string as "missing" — fits the
    // typical untouched-<input>-via-v-model case.
    optionalValue: ['undefined', 'empty_string'],

    // Collapse every optional sentinel to `null` on the way out, so
    // the backend always sees one canonical shape for "no value".
    optionalAs: null,
}));
```

With the plugin installed, every `useValidup` in the app picks up those defaults; per-mount `optionalValue` / `optionalAs` still wins, and `ComposableOptions` can override per-form.

```typescript
useValidup(container, state, {
    // Override the install default for this form only.
    optionalValue: 'falsy',
    optionalAs: '',
});
```

Precedence (highest → lowest): `MountOptions` → `ContainerRunOptions` (forwarded from `ComposableOptions`) → `ContainerOptions` → `ComposableOptions` (when no install) → install options → core default.

For the atomic vocabulary (`'undefined'`, `'null'`, `'empty_string'`, `'zero'`, `'false'`, `'nan'`, `'falsy'`) see validup's [Optional Values](https://www.npmjs.com/package/validup#optional-values) docs.

## Result Caching (automatic)

`useValidup` owns one [`ResultCache`](https://validup.tada5hi.net/guide/caching) per composable scope and passes it on every `safeRun` call. Cross-keystroke runs reuse the cached outcome of any mount whose `(value, context, group)` snapshot didn't change — `$validate()` at submit time skips validators that the per-keystroke runs already proved fresh, so async checks (uniqueness, captcha) don't refire when their inputs haven't changed.

The cache is cleared automatically on `$reset()` and when the container reference swaps; in both cases any pending or in-flight `safeRun` is invalidated first so it can't repopulate the cache or `internalIssues` after the clear.

Mark a validator `sideEffect: true` (via `defineValidator` or an adapter's `{ sideEffect: true }` option) whenever its result is NOT a pure function of `(ctx.value, ctx.context, ctx.group)` — the cache snapshot only captures those three inputs, so anything else the validator reads goes stale silently. That includes:

- **Cross-field validators** that read `ctx.data.otherField` (`@validup/validator-js`'s `equals(key)` without `expectedValue` does this automatically).
- **Network-dependent validators** — uniqueness checks against an API, captcha verifications, server-side rules where the answer can change between calls.
- **Time-varying or globally-mutable state** — anything reading the system clock, a feature flag, a shared store, the URL, etc.

Pure-input validators (regex, length, enum, schema parse against the value alone) stay default-cached and benefit from per-keystroke skip + submit-time skip naturally.

## Async & Debouncing

By default, every state change triggers a fresh `safeRun()` on the container. Concurrent runs are coalesced via a run-id token so "last write wins" — older async results are dropped if newer state has already been written.

A defensive `try/catch` wraps `safeRun` so a buggy `IContainer` implementation that throws (instead of returning `{ success: false, error }`) is surfaced as a synthetic path-less failure in `$crossCuttingErrors` rather than crashing the watcher.

For expensive async validators (e.g. uniqueness checks against an HTTP endpoint), set `options.debounce`:

```typescript
const v = useValidup(uniqueUsernameValidator, form, { debounce: 300 });
```

When a state change schedules a new run, the previous in-flight run is aborted via `AbortSignal` — async validators that pass `ctx.signal` to their I/O (e.g. `fetch(url, { signal: ctx.signal })`) cancel cleanly instead of completing wasted work. The composable also aborts pending runs when the owning effect scope tears down (component unmount). `$validate()` is intentionally **not** auto-cancellable, so a submit-time check can't be aborted by an intervening keystroke.

## Lazy Validation

By default, `useValidup` runs validation **on mount** so `$invalid` reflects the initial state. For forms with expensive async validators (e.g. an HTTP-backed uniqueness check), this on-mount probe is wasteful. Pass `lazy: true` to skip it:

```typescript
const v = useValidup(usernameValidator, form, { lazy: true });

// At this point: no validation has run.
// v.$invalid.value === false, v.$pending.value === false.

// Validation kicks in on the first $model write…
v.fields.username.$model.value = 'peter';

// …or on an explicit $touch() / $validate() call.
await v.$validate();
```

`lazy` does **not** affect what happens *after* the first interaction. Subsequent state changes still trigger validation as normal (subject to `debounce`).

## Auto-Dirty (External State Mutations)

When state is mutated **through `$model`**, `useValidup` flips the matching field's `$dirty` to `true` automatically. When state is mutated **outside** of `$model` — e.g. by a Pinia store action, a programmatic reset, or a parent-driven update — the field stays "clean" by default. This is intentional: it keeps form hydration via `Object.assign(state, entity)` from flashing errors on load.

For Pinia-driven forms where the consumer wants store-action mutations to surface validation errors, opt in with `autoDirty: true`:

```typescript
const store = useFormStore();
const v = useValidup(validator, store.form, { autoDirty: true });

// A store action that mutates store.form will now mark every top-level
// field dirty (errors surface, severity flips). Without `autoDirty`, the
// form would stay quiet until the user interacts via $model.
```

Notes:

- `autoDirty` does **not** fire on the initial mount — only on subsequent state changes.
- It marks every top-level field dirty (coarser than per-field). For wizard-style flows where this is too aggressive, use explicit `v.fields.<name>.$touch()` calls instead.
- Default-off keeps hydration semantics (`Object.assign(state, entity)` leaves the form clean).

## External (Server) Errors

When the server rejects a submission, feed its `Issue[]` straight back into the composable:

```typescript
import { isValidupError } from 'validup';

async function submit() {
    try {
        await api.createRole(form);
    } catch (e) {
        if (isValidupError(e)) {
            v.setExternalIssues(e.issues);
        }
    }
}
```

External issues:

- Surface via `$errors` at the matching path (assuming the field is `$dirty`).
- Carry `meta.external = true` (deep — group children too) so themes can distinguish them from local validation errors.
- **Auto-clear** the moment the user edits the affected field (`$model` write at the same path drops them — including any group descendants under that path).

## Cross-Cutting Errors

`$crossCuttingErrors` collects every path-less issue (`path: []`) — backend rate limits, CSRF failures, schema-level container errors, generic submit failures. Pulled from **both** internal validation runs and `setExternalIssues`, so the same accessor surfaces:

- a synthetic failure produced when a buggy `IContainer` throws (auto-wrapped — see [Async & Debouncing](#async--debouncing));
- a server-supplied path-less issue (`{ path: [], message: 'rate_limit' }`).

Cross-cutting errors are **always visible** — no dirty gate, no field to attach to. External entries also carry `meta.external = true`. Cleared by `$reset()` (external) or overwritten by the next run (internal).

```typescript
<div v-for="err in v.$crossCuttingErrors.value" :key="err.code">
    {{ err.message }}
</div>
```

## Nested Forms

A parent form aggregates one or more child forms via `provide` / `inject`. Children declare their `name` and the parent collects them via `$getResultsForChild(name)`:

```typescript
// parent.vue
import { useValidup, extractResultsFromChild } from '@validup/vue';

const v = useValidup(new Container(), {}, { stopPropagation: true });

async function submit() {
    const data = {
        ...extractResultsFromChild(v, 'basic'),
        ...extractResultsFromChild(v, 'connection'),
    };
    await api.create(data);
}
```

```typescript
// child.vue (BasicFields)
const v = useValidup(new BasicFieldsValidator(), form, { name: 'basic' });
```

`onScopeDispose` automatically unregisters children when their component unmounts.

### How Children Register

The composable wires up child forms with Vue's `provide` / `inject`. The flow:

1. **Every** `useValidup(...)` call (unless `detached: true`) calls `provide(PARENT_INJECTION_KEY, ownRegistry)` — exposing itself as a potential parent for descendants.
2. **Every** `useValidup(...)` call (unless `detached` or `stopPropagation` is set) calls `inject(PARENT_INJECTION_KEY, undefined)` — looking up the nearest ancestor.
3. If a parent is found **and** the child specifies `options.name`, the child auto-registers with the parent's registry under that name.
4. When the child component's setup scope disposes, `onScopeDispose` fires and the child unregisters automatically — no leaks, no manual cleanup.

> [!IMPORTANT]
> Vue's `inject()` only resolves values provided by **ancestor components** — a component never sees its own `provide()`. Two `useValidup()` calls in the same `<script setup>` therefore never link; the child must live in its own component, rendered below the one that owns the parent composable.

The registry is `shallowReactive`, so `$getResultsForChild(name)` is usable **reactively** — a template binding or `computed` over it re-evaluates when the child registers/unregisters, and tracking continues through the returned composable's refs (`$invalid`, `$dirty`, …):

```typescript
// live parent-side aggregation, not just submit-time reads
const address = computed(() => v.$getResultsForChild<AddressShape>('address'));
const sectionInvalid = computed(() => address.value?.$invalid.value ?? false);
```

The injection key is exported as `PARENT_INJECTION_KEY` if you ever need to reach into the registry directly. Scoped trees use a per-scope `Symbol.for('validup:parent:<scope>')` key (see below).

### Scoped Parent / Child Trees

For multi-step wizards or tab panels where each section needs its own aggregation root, use `scope` on **both** the parent and its children. Same-scope children register only with same-scope parents; unscoped children attach only to the nearest unscoped parent.

```typescript
// Wizard parent — has two scoped collectors, one per tab.
const tab1 = useValidup(new Container(), {}, { scope: 'tab1', stopPropagation: true });
const tab2 = useValidup(new Container(), {}, { scope: 'tab2', stopPropagation: true });

// Child component in tab 1
const v = useValidup(profileValidator, form, { scope: 'tab1', name: 'profile' });

// tab1.$getResultsForChild('profile') → defined
// tab2.$getResultsForChild('profile') → undefined  (different scope)
```

Without scopes, every nested `useValidup` call attaches to the single nearest parent collector — fine for forms with one aggregation root, restrictive for split-tab layouts.

### `stopPropagation` vs `detached`

Both flags break the default parent/child auto-attach, but they are **not** the same:

| Flag                       | Calls `inject`? | Calls `provide`? | Use case                                                         |
|----------------------------|-----------------|------------------|------------------------------------------------------------------|
| (default — neither set)    | yes             | yes              | Ordinary nested form. Auto-attaches to the nearest parent and exposes itself as a parent for its own descendants. |
| `stopPropagation: true`    | **no**          | yes              | Aggregation root. Doesn't attach to a higher-level collector, but its descendants still register with it. The dominant pattern for top-level forms. |
| `detached: true`           | **no**          | **no**           | Self-contained widget rendered inside a collector tree but invisible to it (e.g. an embedded settings panel inside a wizard step). Neither attaches to a parent nor exposes itself as one. |

```typescript
// Aggregation root — collects children, ignores any outer parent.
const root = useValidup(new Container(), {}, { stopPropagation: true });

// Standalone widget — won't see `root` and `root` won't see it.
const widget = useValidup(widgetValidator, widgetForm, { detached: true });
```

## Severity

`getSeverity(field)` returns a literal that drops straight into design-system components (e.g. `@vuecs/form-controls`):

| Field state                                                                 | Severity      |
|-----------------------------------------------------------------------------|---------------|
| `$pending`                                                                  | `'warning'`   |
| not yet `$dirty` + `$errors` contains a required-mount item                 | `'warning'`   |
| not yet `$dirty` + `$errors` empty                                          | `undefined`   |
| `$dirty` + `$errors` contains at least one required-mount item              | `'error'`     |
| `$dirty` + `$errors` contains only optional-mount items                     | `'warning'`   |
| `$dirty` + `$errors` empty                                                  | `'success'`   |

The required-vs-optional split is driven by `IssueItem.meta.optional`, which the validup runtime stamps on issues emitted from mounts declared as `optional: true`. The rationale: if the schema permits a field to be blank, invalid content shouldn't gate the user as hard as a required-field failure. Mixed bags (one required + one optional issue on the same path) surface as `'error'` — the required one wins.

`meta.optional` reflects only the most-local mount, so a required leaf inside an optional sub-form still surfaces as `'error'`. ("Role is optional" means *you don't have to provide a role*; once you do, the role's required fields stay required.)

The pristine `'warning'` lets a form communicate "there is work to do" on initial render — e.g. a required `email` field outlines as amber and shows its message before the user touches anything. This works because **`$errors` already filters the items it contains**: required-mount items surface as soon as validation has run (pre-touch included); optional-mount items wait until `$dirty` flips. Consumers using `field.$errors.value.map((i) => i.message)` for rendering automatically pair with `getSeverity` — no `$issues` walk required.

```typescript
import { getSeverity } from '@validup/vue';

buildFormGroup({
    validationSeverity: getSeverity(v.fields.name),
    validationMessages: v.fields.name.$errors.value.map((i) => i.message),
    // …
});
```

## API Reference

### `useValidup(container, state, options?)`

```ts
function useValidup<T extends ObjectLiteral, C = unknown>(
    container: IContainer<T, C> | Ref<IContainer<T, C>>,
    state: T | Ref<T>,
    options?: ComposableOptions<T, C>,
): Composable<T>;

interface ComposableOptions<T, C = unknown> {
    group?: MaybeRef<string | undefined>;
    context?: MaybeRef<C | undefined>; // forwarded as ValidatorContext.context; reactive
    debounce?: number;
    name?: string;
    stopPropagation?: boolean;  // skip inject(), still provide() — aggregation root
    detached?: boolean;         // skip both inject() and provide() — invisible
    lazy?: boolean;             // skip the on-mount validation run
    autoDirty?: boolean;        // mark dirty on any state change, not just $model writes
    scope?: string;             // partition the parent/child collector tree
}
```

### `Composable<T>`

| Member                            | Description                                                                                                |
|-----------------------------------|------------------------------------------------------------------------------------------------------------|
| `$invalid` / `$pending` / `$dirty`| Form-level computeds. `$pending` is form-wide (one run per container).                                     |
| `$errors`                         | Flat list of visible leaf issues (path-attached only). Required-mount items show immediately; optional-mount items wait for `$dirty`. |
| `$issues`                         | Raw `Issue[]` for the whole form.                                                                          |
| `$crossCuttingErrors`             | Path-less `IssueItem[]` (always visible). Sources: internal runs + `setExternalIssues`.                    |
| `$groupErrors`                    | `IssueGroup[]` — group-level issues like `ONE_OF_FAILED`, dirty-gated.                                     |
| `$touch()` / `$reset()`           | Form-level dirty toggles. `$reset` does **not** clear internal issues (they reflect current state).        |
| `$validate()`                     | Touch every field, run, return the `Result<T>`. Cancels any pending debounced run first.                   |
| `setExternalIssues(issues)`       | Inject server-side issues. Tagged `meta.external = true` (deep — group children too). Cleared by `$reset()`. |
| `$getResultsForChild(name)`       | Resolve a registered child composable (only if `options.name` was set on the child). Reactive — the registry is `shallowReactive`, so templates / `computed`s track register/unregister. |
| `fields.<key>`                    | Per-field `FieldState<T[K]>` for top-level entity keys (strict-mode clean — never `\| undefined`).         |
| `fields.at(<path>)`               | Per-field `FieldState` accessor for dotted / bracketed / runtime-computed paths (`'user.email'`, `'tags[0]'`). |

### Helpers

| Export                            | Purpose                                                |
|-----------------------------------|--------------------------------------------------------|
| `getSeverity(field)`       | `'success' \| 'warning' \| 'error' \| undefined` — optional-aware (see [Severity](#severity)) |
| `extractResultsFromChild`  | Splice a child composable's `$model` values into one object |
| `PARENT_INJECTION_KEY`            | The `provide`/`inject` key used for parent collectors  |

## Migrating from Vuelidate

The composable shape is intentionally vuelidate-compatible. For most templates you only swap the **call-site**:

```diff
- import useVuelidate from '@vuelidate/core';
- import { required, minLength, maxLength } from '@vuelidate/validators';
+ import { useValidup } from '@validup/vue';
+ import { RoleValidator } from '@my-app/validators';

  const form = reactive({ name: '' });

- const $v = useVuelidate({
-     name: { required, minLength: minLength(3), maxLength: maxLength(128) },
- }, form);
+ const v = useValidup(new RoleValidator(), form, { group: 'create' });
```

Templates rarely change:

| Vuelidate                                         | `@validup/vue`                                    |
|---------------------------------------------------|-----------------------------------------------------------|
| `$v.value.$invalid`                               | `v.$invalid.value`                                       |
| `$v.value.<field>.$model`                         | `v.fields.<field>.$model.value`                          |
| `$v.value.<field>.$dirty`                         | `v.fields.<field>.$dirty.value`                          |
| `$v.value.<field>.$invalid`                       | `v.fields.<field>.$invalid.value`                        |
| `$v.value.<field>.$errors`                        | `v.fields.<field>.$errors.value` (validup `IssueItem[]`) |
| `$v.value.$touch()`                               | `v.$touch()`                                             |
| `$v.value.$reset()`                               | `v.$reset()`                                             |
| `getSeverity($v.value.<field>)` (`@ilingo/vuelidate`) | `getSeverity(v.fields.<field>)`               |
| `useVuelidate({ $stopPropagation: true })` parent | `useValidup(container, state, { stopPropagation: true })` |
| nested child `useVuelidate(rules, form)`          | nested child `useValidup(container, form, { name })`      |
| `$v.value.$getResultsForChild(name)`              | `v.$getResultsForChild(name)`                            |
| `extractVuelidateResultsFromChild(...)` (custom)  | `extractResultsFromChild(v, name)`                |

What changes substantively:

- **Per-field error keys** — Vuelidate's `$errors` is a list of `{ $validator, $message, $data }` objects keyed by rule name. validup's `$errors` is a list of `IssueItem` (`{ code, path, message, expected, received, meta }`). If your template iterates `$v.value.<field>.$errors`, switch the loop variable to read `err.message` and `err.code`.
- **Translation** — built-in messages live in [`@ilingo/validup`](https://www.npmjs.com/package/@ilingo/validup) (sibling to the existing `@ilingo/vuelidate`). The migration replaces `useTranslationsForNestedValidation($v.value)` with `useTranslationsForValidup(v)`.
- **Async timing** — `options.lazy` is the analog of Vuelidate's `$lazy: true`. By default, validation runs eagerly internally and per-field error rendering is gated on `$dirty`, so the visible UX matches Vuelidate's `$lazy: true`. Pass `lazy: true` to additionally skip the on-mount probe (useful for expensive async validators).
- **`$autoDirty`** — set `options.autoDirty: true` when state is mutated outside of `$model` (e.g. via Pinia store actions). Default-off preserves silent hydration.
- **`$scope`** — set `options.scope` on both parent and children to partition multiple aggregation roots (multi-step wizards, tab panels). Replaces Vuelidate's `$scope` config.

## Stability

What's covered by semver:

- **Public exports** — `useValidup`, `getSeverity`, `extractResultsFromChild`, `PARENT_INJECTION_KEY`, and the `Composable` / `FieldState` / `ComposableOptions` / `Severity` types.
- **`Composable<T>` shape** — every documented member in the [API Reference](#api-reference) table, including the `$crossCuttingErrors` / `$groupErrors` accessors and the `setExternalIssues` / `$validate` / `$getResultsForChild` methods.
- **Options contract** — `group`, `context`, `debounce`, `name`, `stopPropagation`, `detached`, `lazy`, `autoDirty`, `scope`. New options will be additive within a major.
- **Parent / child collector protocol** — `PARENT_INJECTION_KEY` and per-scope `Symbol.for('validup:parent:<scope>')` are the wire format. Third-party composables can `provide` / `inject` the same key to participate.
- **Dirty / external-issue semantics** — `$model` writes flip dirty + auto-clear external issues at the same path; `$reset` clears dirty + external but leaves internal issues (which reflect current state); `setExternalIssues` tags entries with `meta.external = true`.

Extension points:

- **Custom aggregation roots** — `stopPropagation: true` (collect descendants, ignore ancestors) and `detached: true` (invisible in both directions) are the two blessed shapes.
- **Buggy `IContainer` safety net** — a defensive `try/catch` around `safeRun` surfaces a path-less synthetic `IssueItem` (`code: VALUE_INVALID`) in `$crossCuttingErrors` rather than crashing the watcher.

Internal (no semver guarantee):

- The `Proxy`-backed `fields` accessor's exact dispatch (`getOwnPropertyDescriptor` returning a data descriptor with `value`, etc.) — observable behavior (per-field state, reactive key tracking) is stable; the underlying mechanism is not.
- The run-id / abort token internals.

Peer dependency policy:

- `validup ^1.0.0`, `vue ^3.3`. Both must be installed by the consumer; `@validup/vue` does not bundle either.
- `@vueuse/core` — transitive runtime dependency.

Deprecation policy: matches [`validup`](https://npmjs.com/package/validup) — at least one minor release of `@deprecated` notice before removal in a major.

## License

Made with 💚

Published under [Apache 2.0 License](./LICENSE).

[npm-version-src]: https://badge.fury.io/js/@validup%2Fvue.svg
[npm-version-href]: https://npmjs.com/package/@validup/vue
[workflow-src]: https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg
[workflow-href]: https://github.com/tada5hi/validup/actions/workflows/main.yml
[codeql-src]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg
[codeql-href]: https://github.com/tada5hi/validup/actions/workflows/codeql.yml
[snyk-src]: https://snyk.io/test/github/tada5hi/validup/badge.svg
[snyk-href]: https://snyk.io/test/github/tada5hi/validup
[conventional-src]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white
[conventional-href]: https://conventionalcommits.org
