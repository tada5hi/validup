/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ComputedRef,
    MaybeRef,
    Ref,
    WritableComputedRef,
} from 'vue';
import type {
    Issue,
    IssueGroup,
    IssueItem,
} from 'blemish';
import type {
    ContainerRunOptions,
    IContainer,
    ObjectLiteral,
    Result,
} from 'validup';

export type Severity = 'success' | 'warning' | 'error' | undefined;

export type FieldState<V = unknown> = {
    readonly $model: WritableComputedRef<V>;
    readonly $invalid: ComputedRef<boolean>;
    /**
     * Form-level pending flag (mirrored on every field for ergonomic template
     * use). True while *any* validation run is in flight — validup runs the
     * whole container in one pass, so there is no per-field pending state.
     */
    readonly $pending: ComputedRef<boolean>;
    readonly $dirty: ComputedRef<boolean>;
    /**
     * Visible errors at or below this path. Includes external issues.
     *
     * Required-mount items surface unconditionally — they communicate
     * "this field has unresolved work" the moment validation has run,
     * so a form can render the issue (and the matching `getSeverity` →
     * `'warning'`) on initial load without the user touching every field.
     * Optional-mount items (those with `meta.optional: true`, stamped by
     * the validup runtime for `optional: true` mounts) stay hidden until
     * `$dirty` flips — the schema permits leaving the field blank, so
     * we don't nag.
     */
    readonly $errors: ComputedRef<IssueItem[]>;
    /** Raw issues at or below this path (groups + items), regardless of dirty state. */
    readonly $issues: ComputedRef<Issue[]>;
    $touch(): void;
    $reset(): void;
};

export type Composable<T extends ObjectLiteral = ObjectLiteral> = {
    readonly $invalid: ComputedRef<boolean>;
    readonly $pending: ComputedRef<boolean>;
    readonly $dirty: ComputedRef<boolean>;
    /**
     * Flat list of every visible leaf issue across the form (path-attached
     * only — `$crossCuttingErrors` carries the path-less ones).
     *
     * Required-mount items surface unconditionally; optional-mount items
     * (`meta.optional: true`) only surface once the matching path is dirty.
     * Same rule as `FieldState.$errors` — see its JSDoc for the rationale.
     */
    readonly $errors: ComputedRef<IssueItem[]>;
    /** Raw issues for the whole form (groups + items), regardless of dirty state. */
    readonly $issues: ComputedRef<Issue[]>;
    /**
     * Path-less issues (`path: []`) — cross-cutting failures like rate
     * limiting, CSRF, schema-level container errors, or generic submit
     * failures. Pulled from BOTH internal validation runs and `setExternalIssues`.
     * Always visible (no dirty gate). External entries carry
     * `meta.external = true` so themes can distinguish them. Cleared by
     * `$reset()` (external) and overwritten by the next run (internal).
     */
    readonly $crossCuttingErrors: ComputedRef<IssueItem[]>;
    /**
     * Group-level issues (e.g. `IssueCode.ONE_OF_FAILED` from a `oneOf`
     * container). Dirty-gated: empty-path groups surface once any field is
     * dirty; nested groups follow the same prefix-dirty rules as field errors.
     */
    readonly $groupErrors: ComputedRef<IssueGroup[]>;

    $touch(): void;
    $reset(): void;
    $validate(): Promise<Result<T>>;

    /** Inject server-side issues. Auto-cleared at a path when its `$model` is written. */
    setExternalIssues(issues: Issue[]): void;

    /**
     * Resolve a registered child composable by `options.name`. Reactive —
     * the registry is `shallowReactive`, so calling this inside a template
     * or `computed` re-evaluates when the child registers/unregisters.
     */
    $getResultsForChild<C extends ObjectLiteral = ObjectLiteral>(name: string): Composable<C> | undefined;

    /**
     * Per-field accessor. Top-level keys narrow to `FieldState<T[K]>` —
     * strict-mode clean (no `| undefined` from a fallback index signature).
     * Use `fields.at('user.email')` for dotted / bracketed / runtime-computed
     * paths where the typed proxy keys can't express what you need.
     */
    readonly fields: FieldsAccessor<T>;
};

/**
 * Value type for one `FieldsAccessor` key.
 *
 * In the homomorphic mapping below, `K` is the *literal* key for every
 * declared property of `T`, and the index-signature key (`string` /
 * `number`) for the single catch-all entry that a `[key: string]: any`
 * on `T` contributes. Declared keys map to a real `FieldState`; the
 * catch-all entry deliberately widens to `any` — see the third
 * constraint in `FieldsAccessor`.
 */
type FieldEntry<T, K extends keyof T> = string extends K ?
    any :
    number extends K ?
        any :
        FieldState<T[K]>;

/**
 * Typed accessor returned by `Composable.fields`.
 *
 * - `fields.<key>` — typed access for known keys of `T`. Returns
 *   `FieldState<T[K]>` (NOT `| undefined`) so strict-mode TypeScript
 *   (`noUncheckedIndexedAccess`) doesn't require non-null assertions on
 *   every template reference.
 * - `fields.at(path)` — dynamic accessor for dotted (`'user.email'`),
 *   bracketed (`'tags[0]'`), or mixed (`'matrix[0].name'`) paths and any
 *   runtime-computed key. Returns `FieldState<V>`; the underlying Proxy
 *   materialises a `FieldState` on first access so the return is never
 *   actually undefined at runtime.
 *
 * ## Why the mapping looks like this
 *
 * Three constraints pull in different directions, and the shape below is
 * the only one found to satisfy all three. Each has a regression case in
 * `test/unit/typing.spec.ts`; changing one line here reliably breaks one
 * of the others, so re-run that spec (`npm run test:types`) rather than
 * "simplifying".
 *
 * 1. **No optional marker on the property** (#391). A field declared
 *    `nickname?: string` must still yield a bare
 *    `FieldState<string | undefined>`, not
 *    `FieldState<string | undefined> | undefined` — the Proxy
 *    materialises a `FieldState` for every key on first access, so the
 *    property itself is never undefined at runtime. Hence `-?`. (It
 *    strips the marker only, not the value type's own `undefined`.)
 * 2. **`Composable<Specific>` stays assignable to
 *    `Composable<ObjectLiteral>`** (#423). Generic components declare
 *    props as `Composable<ObjectLiteral>` and receive typed composables.
 *    When `T` widens to `ObjectLiteral` the mapped type collapses to a
 *    bare index signature, and every property of the *source* — including
 *    the sibling `at` method — then has to satisfy that index signature's
 *    value type. A function is not a `FieldState`, so a `FieldState<…>`
 *    value type rejects it. Widening the catch-all entry to `any` (see
 *    `FieldEntry`) is what lets `at` through.
 * 3. **Declared keys survive an index signature on `T`** (#455). Entity
 *    types commonly carry `[key: string]: any` for extra attributes.
 *    `keyof T` then widens to `string | number`, so any mapping keyed off
 *    `keyof T` as a *set* (e.g. `K in Exclude<keyof T, 'at'>`) collapses
 *    to a bare index signature and every declared key loses its type.
 *    Only a **homomorphic** mapping (`K in keyof T as …`) walks the
 *    declared properties and the index signature separately, keeping
 *    `fields.name` at `FieldState<string>`.
 *
 * Consequence of (2): for a `T` that carries an index signature, keys not
 * declared on `T` read as `any` rather than `FieldState<any>`. Declared
 * keys are unaffected, and a `T` without an index signature still rejects
 * unknown keys outright, so typo detection is preserved where it exists.
 *
 * Caveat: a field literally named `at` is shadowed by the dynamic
 * accessor. Access it via `fields.at('at')` (or pick a different field
 * name) — a deliberate trade-off to keep the accessor discoverable on
 * the same object as the typed keys.
 */
export type FieldsAccessor<T extends ObjectLiteral> = {
    readonly [K in keyof T as K extends 'at' ? never : K]-?: FieldEntry<T, K>;
} & {
    /**
     * Look up field state by dotted / bracketed path or any
     * runtime-computed key. Returns `FieldState<V>` (no `| undefined`):
     * the Proxy materialises a `FieldState` on first access, so the
     * lookup never fails at runtime.
     */
    at<V = unknown>(path: string): FieldState<V>;
};

export type ComposableOptions<T extends ObjectLiteral, C = unknown> = {
    /** Active container group. Reactive when a ref is passed. */
    group?: MaybeRef<string | undefined>;

    /**
     * Caller-supplied context surfaced on every `ValidatorContext.context` for
     * this run. Reactive — when wrapped in a `ref`, changes trigger re-validation
     * the same way `state`/`group` do. Useful for request-scoped data (current
     * user, locale, feature flags) that validators need but isn't part of the
     * validated state.
     */
    context?: MaybeRef<C | undefined>;

    /** Debounce window in ms for re-running validation on state change. Default: 0. */
    debounce?: number;

    /** Identifier when registered as a child composable. */
    name?: string;

    /**
     * Don't register this composable with an ancestor collector (i.e. skip
     * the upward `inject()` call), but still `provide()` self downward so
     * descendants can register with this composable. Use this on a parent
     * form that *aggregates* nested children but should not be attached to
     * an even-higher-level collector.
     */
    stopPropagation?: boolean;

    /**
     * Truly standalone — skip BOTH the upward `inject()` AND the downward
     * `provide()`. A `detached` composable neither registers with a parent
     * nor exposes itself as one. Useful for self-contained widgets that
     * happen to render inside a form-collector tree but should be invisible
     * to it (e.g. an embedded settings panel inside a wizard step).
     */
    detached?: boolean;

    /**
     * Skip the on-mount validation run. Validation kicks in on the first
     * `$model` write, explicit `$touch()`, or `$validate()` call. Useful for
     * forms with expensive async validators (e.g. HTTP uniqueness checks)
     * where the on-mount probe is wasteful. Default: `false`.
     */
    lazy?: boolean;

    /**
     * Mark every top-level field dirty whenever the state object changes.
     * Useful when state is mutated outside of `$model` (e.g. via a Pinia
     * store action, programmatic resets, parent-driven updates) and the
     * consumer wants those changes to surface validation errors. Default:
     * `false` (so hydration via `Object.assign(state, entity)` stays clean).
     */
    autoDirty?: boolean;

    /**
     * Scope name for the parent/child collector tree. A `useValidup` parent
     * with `scope: 'A'` collects only descendants that pass the same scope;
     * descendants without a scope still attach to the nearest unscoped
     * parent. Useful for multi-step wizards or tab panels where each scope
     * needs its own aggregation root.
     */
    scope?: string;

    /**
     * Run-level fallback for `MountOptions.optionalValue`. Forwarded to
     * `safeRun` (and `$validate()`'s internal run) so any mount that
     * declares `optional: true` without setting its own `optionalValue`
     * picks this up.
     *
     * When unset, falls back to the install option supplied via
     * `app.use(createValidup({ optionalValue }))`. When neither is set,
     * the run-loop falls through to `ContainerOptions.optionalValue`
     * and then the core default (`'undefined'`).
     */
    optionalValue?: ContainerRunOptions<T, C>['optionalValue'];

    /**
     * Run-level fallback for `MountOptions.optionalAs`. Forwarded to
     * `safeRun`; written to the output whenever an optional mount
     * doesn't set its own `optionalAs`.
     *
     * Presence (not value) matters — `{ optionalAs: undefined }` is a
     * meaningful directive ("emit `undefined`") and differs from
     * omitting the option.
     *
     * When unset, falls back to the install option supplied via
     * `app.use(createValidup({ optionalAs }))`. When neither is set,
     * the run-loop falls through to `ContainerOptions.optionalAs` (if
     * any) or otherwise behaves as if no `optionalAs` were configured.
     */
    optionalAs?: unknown;
};

export type ParentRegistry = {
    register(name: string, child: Composable<any>): void;
    unregister(name: string): void;
};

/**
 * State accepted by `useValidup`. Typed as `Partial<T>` so a form that only
 * carries a subset of the validator's entity fields type-checks without a
 * cast (e.g. a `Container<User>` driving a `{ name, email }` create form
 * where `id` / `createdAt` are server-set). The runtime treats unmounted
 * keys as pass-through.
 *
 * Wrapped in `NoInfer` at the call site so the form's narrower shape
 * doesn't pull `T` toward itself — `T` stays bound to the container's
 * entity type, keeping `Composable<T>['fields']` strict-mode-clean.
 */
export type StateInput<T extends ObjectLiteral> = Partial<T> | Ref<Partial<T>>;
export type ContainerInput<T extends ObjectLiteral, C = unknown> = IContainer<T, C> | Ref<IContainer<T, C>>;
