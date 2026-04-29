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
     * External issues with no field path (`path: []`) — cross-cutting backend
     * errors like rate limiting, CSRF, or generic submit failures. Always
     * visible (no dirty gate). Cleared by `$reset()`.
     */
    readonly $externalErrors: ComputedRef<IssueItem[]>;
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

    /** Per-field accessor — proxies to `fields[<key>]`. */
    readonly fields: { readonly [K in keyof T]: FieldState<T[K]> };
}

export interface ValidupComposableOptions<T extends ObjectLiteral> {
    /** Active container group. Reactive when a ref is passed. */
    group?: MaybeRef<string | undefined>;

    /** Debounce window in ms for re-running validation on state change. Default: 0. */
    debounce?: number;

    /** Identifier when registered as a child composable. */
    name?: string;

    /** Stop propagating into ancestor collectors. */
    stopPropagation?: boolean;

    /** Suppress automatic registration with a parent collector even if one is in scope. */
    detached?: boolean;
}

export interface ParentRegistry {
    register(name: string, child: ValidupComposable<any>): void;
    unregister(name: string): void;
}

export type StateInput<T extends ObjectLiteral> = T | Ref<T>;
export type ContainerInput<T extends ObjectLiteral> = IContainer<T> | Ref<IContainer<T>>;
