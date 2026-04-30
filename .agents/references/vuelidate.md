# Vuelidate Reference

`@validup/vue` is **directly inspired by [Vuelidate](https://github.com/vuelidate/vuelidate)**. The composable shape (`$invalid`, `$dirty`, `$pending`, `$errors`, per-field `$model` writable computeds, parent/child auto-registration, severity gating on `$dirty`) is intentionally close to vuelidate so authup form components can migrate by swapping the call-site only. The key difference: vuelidate's per-field state is keyed by **rule name** (`required`, `minLength`) returned by `@vuelidate/validators` factories, while ours is keyed by **path** in the input object and powered by a validup `Container<T>` — meaning the same validator can run server-side via `RoutupContainerAdapter` and client-side via `useValidup()`.

## Version Snapshot (as of 2026-04-29)

| | Version | Date | Commit |
|---|---------|------|--------|
| **`@vuelidate/core` (npm)** | v2.0.3 | 2023-06-29 | — |
| **`@vuelidate/validators` (npm)** | v2.0.4 | 2023-06-29 | — |
| **`next` branch HEAD** (Vue 3 line) | — | 2025-06-10 | `1c7bac7` |
| **`master` branch HEAD** (Vue 2 line, archived) | — | 2021-12-11 | `663f8e4` |

Repo: <https://github.com/vuelidate/vuelidate>
Default branch: `next`

> The npm-published `2.0.3` / `2.0.4` are old, but the `next` branch is the only line that supports Vue 3 and is the canonical reference for our adapter. authup currently consumes `^2.0.3` / `^2.0.4`.

## Concept Mapping (Vuelidate → `@validup/vue`)

| Concept | Vuelidate | `@validup/vue` |
|---------|-----------|------------------------|
| **Composable entry** | `useVuelidate(rules, state, options?)` | `useValidup(container, state, options?)` |
| **Rules source** | Plain object literal of rule factories per field | A `Container<T>` (or `Ref<Container<T>>`) — same instance reused server/client |
| **Built-in rule lib** | `@vuelidate/validators` (`required`, `email`, `minLength`, `helpers.regex`, …) | None. Bring your own validators (typically zod via `@validup/zod`) |
| **Whole-form invalid** | `v$.value.$invalid` | `$v.$invalid.value` |
| **Per-field invalid** | `v$.value.<field>.$invalid` | `$v.fields.<field>.$invalid.value` |
| **Per-field dirty** | `v$.value.<field>.$dirty` | `$v.fields.<field>.$dirty.value` |
| **Per-field model proxy** | `v$.value.<field>.$model` (writable) | `$v.fields.<field>.$model.value` (writable) |
| **Auto-touch on $model write** | Yes (default) | Yes (Q5 decision) |
| **Touch / reset** | `$touch()` / `$reset()` (per-field and whole-form) | identical |
| **Async / pending state** | `$pending` per rule + per field | `$pending` per field, single boolean per form |
| **Per-field errors list** | `$errors` (rule-keyed `{$validator, $message, $params, $pending, $invalid}`) | `$errors: IssueItem[]` (validup `Issue` shape — `{code, path, message, expected, received, meta}`) |
| **External (server) errors** | `$externalResults` (Vue 3 `next` branch) | `$v.setExternalIssues(issues)` (Q4 decision) |
| **Parent/child auto-register** | `useVuelidate({ $stopPropagation: true })` parent + nested `useVuelidate(rules, form)` children | `useValidup(parent, ..., { stopPropagation })` + child `useValidup(child, ..., { name: 'foo' })` via `provide` / `inject` (`PARENT_INJECTION_KEY`) |
| **Get child state** | `v$.value.$getResultsForChild(name)` | `$v.$getResultsForChild(name)` (returns the child `ValidupComposable`) |
| **Lazy mode** | `useVuelidate(rules, state, { $lazy: true })` | Not implemented — always-eager internally; visibility gated on `$dirty` (Q3) |
| **Severity helper** | `getSeverity(validation)` from `@ilingo/vuelidate` | `getValidupSeverity(state)` (this package) |
| **Translation** | `@ilingo/vuelidate` (rule-keyed messages) | `@ilingo/validup` (issue-code-keyed messages) — separate package, see [`ilingo.md`](../plans/ilingo.md) |

## Code Mapping

| Concept | Vuelidate (`packages/vuelidate/src/`) | `@validup/vue` (`packages/vue/src/`) |
|---------|---------------------------------------|------------------------------------------------------|
| **Public composable** | `index.ts` → `useVuelidate()` | `module.ts` → `useValidup()` |
| **Per-field state factory** | inline in `useVuelidate` (uses `setValidations`) | `module.ts` → `buildFieldState()` |
| **Issue path filtering** | Not applicable — rules are field-scoped | `module.ts` → `flatItemsAtPath()`, `rawIssuesAtPath()`, `clearExternalAtPath()` |
| **Stale-result cancellation** | Async validators tracked per-rule | `module.ts` → `runId` token in `runOnce()` (Q2 decision) |
| **Parent injection key** | Internal `VuelidateInjectChildResults` symbol | `helpers/child.ts` → `PARENT_INJECTION_KEY` |
| **Child registration** | `setValidations` walks `provides` to find parent | `module.ts` — `inject(PARENT_INJECTION_KEY)` + `provide()` of own registry |
| **Severity helper** | (lives in `@ilingo/vuelidate/src/helpers/severity.ts`) | `helpers/severity.ts` → `getValidupSeverity()` |
| **Extract child results** | `$getResultsForChild(name)` reads `nestedResults` map | `helpers/child.ts` → `extractValidupResultsFromChild()` walks `child.fields[].$model.value` |
| **External error injection** | `$externalResults` two-way ref | `module.ts` → `setExternalIssues()` (with `meta.external = true` flag) |

## Architectural Divergences Worth Knowing

### What we kept from Vuelidate
- The composable shape — `$invalid` / `$dirty` / `$pending` / `$errors` / `$touch` / `$reset` are 1:1 by name and semantics so authup templates port without changes.
- `$model` writable computed per field, with auto-touch on write (matches vuelidate's default).
- Parent collector + child auto-registration via `provide`/`inject`, and `$getResultsForChild(name)` to splice nested form output.
- Severity ladder: `undefined` (clean) → `'warning'` (pending) → `'error'` (dirty + invalid) → `'success'` (dirty + valid).
- Eager validation under the hood, visibility gated on `$dirty` per field.

### What we changed
- **Rules come from a `Container<T>`, not a literal object.** Mounting / nesting / globs / groups / `oneOf` all live in the validup core, so the same validator runs server-side via `RoutupContainerAdapter` and client-side via `useValidup`.
- **No bundled rule library.** Vuelidate ships `@vuelidate/validators` with `required`, `email`, etc. We don't — bring your own validator (zod is the default story via `@validup/zod`).
- **Per-field state is keyed by path, not by rule.** A field has a flat list of `IssueItem`s, not a per-rule sub-object. Templates that displayed "this rule failed" must shift to "this issue (with code `X`) was raised" — the `@ilingo/validup` plugin handles the translation.
- **`Issue` carries structured metadata.** `IssueItem.expected` / `received` / `meta` make rich error rendering possible without a bespoke rule API. Vuelidate's `$params` is the rough analog.
- **Group filtering replaces `$stopPropagation` for "different rules under different conditions".** Where vuelidate users encode create/update via two separate `useVuelidate` calls (or `validations()` returning different objects), validup mounts the same field twice with different `group: ['create']` / `group: ['update']` flags and we forward the active group via `options.group`.
- **External issues via explicit method.** Vuelidate's `$externalResults` is a two-way ref the consumer must clear; we use `setExternalIssues(issues)` and auto-clear on `$model` write at the same path.
- **No `$autoDirty`, `$scope`, `$registerAs`, `$lazy`.** Out of scope for the initial release — we picked the minimum surface authup actually consumes.

### What Vuelidate has that we don't
- A first-party rule library (`@vuelidate/validators`).
- `$lazy` mode flag — we always validate eagerly internally.
- `$autoDirty` — automatic dirty tracking via watch on `state` (we use `$model` write hooks instead).
- `$scope` — used by Vuelidate to scope nested groups to specific child trees. Not yet needed for authup's patterns.
- Vue 2 support. We are Vue-3-only.
- `$silentErrors` / `$silentInvalid` (errors that don't gate on `$dirty`). Our `$issues` / `$invalid` provide the same data; we just chose different names.

## Areas to Watch

When Vuelidate ships a new line, review for:
- Changes to the `BaseValidation` shape (`$dirty`, `$pending`, `$errors` subkey changes) — our `FieldState` surface mirrors this and authup expects parity.
- New `$externalResults` semantics — if Vuelidate adds field-level auto-clear or merge strategies, our `setExternalIssues` should track.
- `$lazy` / `$autoDirty` changes — these affect the unwritten Q1/Q5 alternatives in [`vue.md`](../plans/vue.md).
- Async validator timing changes (debounce, cancellation patterns) — we currently mirror "no debounce, last-write-wins via run-id" (Q2). Vuelidate's choices are a useful sanity check.
- Composition API parent/child injection key — our `PARENT_INJECTION_KEY` mirrors theirs; if vuelidate changes from `Symbol.for('vuelidate:children')` to a registry pattern we may want to follow.
- Validation rule helpers (e.g. `withMessage`, `withParams`) — these have no analog in validup since rules come from a `Container`, but watch for patterns that do translate (e.g. async-with-cancellation).

## Cross-References

- Plan: [`.agents/plans/vue.md`](../plans/vue.md) — full design and migration plan for `@validup/vue`.
- Plan: [`.agents/plans/ilingo.md`](../plans/ilingo.md) — sibling translation package to replace `@ilingo/vuelidate`.
- Architecture: [`.agents/architecture.md`](../architecture.md) — `Container` / `Validator` / `Issue` model that the Vue integration consumes.
