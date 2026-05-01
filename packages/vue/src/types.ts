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
    IContainer,
    Issue,
    IssueGroup,
    IssueItem,
    ObjectLiteral,
    Result,
} from 'validup';

export type ValidupSeverity = 'success' | 'warning' | 'error' | undefined;

export interface FieldState<V = unknown> {
    readonly $model: WritableComputedRef<V>;
    readonly $invalid: ComputedRef<boolean>;
    /**
     * Form-level pending flag (mirrored on every field for ergonomic template
     * use). True while *any* validation run is in flight — validup runs the
     * whole container in one pass, so there is no per-field pending state.
     */
    readonly $pending: ComputedRef<boolean>;
    readonly $dirty: ComputedRef<boolean>;
    /** Visible errors — gated on `$dirty`. Includes external issues at this path. */
    readonly $errors: ComputedRef<IssueItem[]>;
    /** Raw issues at or below this path (groups + items), regardless of dirty state. */
    readonly $issues: ComputedRef<Issue[]>;
    $touch(): void;
    $reset(): void;
}

export interface ValidupComposable<T extends ObjectLiteral = ObjectLiteral> {
    readonly $invalid: ComputedRef<boolean>;
    readonly $pending: ComputedRef<boolean>;
    readonly $dirty: ComputedRef<boolean>;
    /** Flat list of every leaf issue across the form (dirty-gated). */
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

    /** Resolve a registered child composable by `options.name`. */
    $getResultsForChild<C extends ObjectLiteral = ObjectLiteral>(name: string): ValidupComposable<C> | undefined;

    /**
     * Per-field accessor. Top-level keys narrow to `FieldState<T[K]>`;
     * dotted (`'user.email'`) and bracketed (`'tags[0]'`) paths fall back to
     * `FieldState<any>` since their value type can't be derived structurally.
     */
    readonly fields: { readonly [K in keyof T]: FieldState<T[K]> } & Record<string, FieldState<any>>;
}

export interface ValidupComposableOptions<T extends ObjectLiteral, C = unknown> {
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
}

export interface ParentRegistry {
    register(name: string, child: ValidupComposable<any>): void;
    unregister(name: string): void;
}

export type StateInput<T extends ObjectLiteral> = T | Ref<T>;
export type ContainerInput<T extends ObjectLiteral, C = unknown> = IContainer<T, C> | Ref<IContainer<T, C>>;
