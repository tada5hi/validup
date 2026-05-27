/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from 'validup';
import {
    getCurrentInstance,
    getCurrentScope,
    inject,
    onScopeDispose,
    provide,
} from 'vue';
import type { Composable, ParentRegistry } from '../types';
import { PARENT_INJECTION_KEY } from './child';

/**
 * Subset of `ComposableOptions` that drives parent/child collector
 * behaviour. Carved out so the collector helper has a focused signature and
 * is testable in isolation; the public composable surface continues to
 * accept the full options object.
 */
export type CollectorOptions = {
    /** Identifier under which this composable registers with an ancestor collector. */
    name?: string;
    /** Partition key — same-scope parents collect same-scope descendants only. */
    scope?: string;
    /**
     * Skip BOTH `inject()` and `provide()` — invisible to ancestors *and*
     * descendants.
     */
    detached?: boolean;
    /**
     * Skip `inject()` (don't attach to a higher-level parent) but still
     * `provide()` self so descendants can register. The common aggregation-root
     * shape.
     */
    stopPropagation?: boolean;
};

/**
 * Internal — return shape of `useCollector`. The composable uses
 * `childRegistry` to satisfy `$getResultsForChild` and calls `attach(self)`
 * once its own object literal is built so parent registration sees the
 * already-shaped composable rather than a half-constructed reference.
 */
export type Collector = {
    /**
     * Live map of name → composable for child forms that registered with
     * this collector. Plain `Map` (not `reactive()`) on purpose — children
     * are consumed imperatively (typically inside a submit handler), and a
     * reactive wrapper would unwrap nested refs in the child composable's
     * public type.
     */
    readonly childRegistry: Map<string, Composable<ObjectLiteral>>;

    /**
     * Register `composable` with the parent collector (if any) under
     * `options.name`. Idempotent — calling it more than once with the same
     * collector instance has the same effect as calling it once. Hooks
     * `onScopeDispose` to auto-unregister when the owning effect scope tears
     * down.
     */
    attach(composable: Composable<ObjectLiteral>): void;
};

/**
 * Carves the parent/child collector concern out of `useValidup`. Builds the
 * `childRegistry`, calls `inject()` / `provide()` according to the flags,
 * and exposes `attach(composable)` so the caller can register the
 * fully-built composable with the parent at the end of setup.
 *
 * Not re-exported from the package barrel — this is an internal helper.
 * Promote to a public export only when an external consumer surfaces a
 * concrete need for the split.
 */
export function useCollector(options: CollectorOptions): Collector {
    const childRegistry = new Map<string, Composable<ObjectLiteral>>();

    const ownRegistry: ParentRegistry = {
        register(name, child) {
            childRegistry.set(name, child);
        },
        unregister(name) {
            childRegistry.delete(name);
        },
    };

    // Scoped parent/child injection — same-scope parents see same-scope
    // descendants; the unscoped key continues to behave as before.
    //
    // Test for `undefined` explicitly rather than truthy — an empty-string
    // scope is unusual but the consumer has clearly opted in to scoping by
    // passing the option, and it should get its own `Symbol.for()` key rather
    // than being silently collapsed back to the unscoped default.
    const ownInjectionKey = options.scope !== undefined ?
        Symbol.for(`validup:parent:${options.scope}`) :
        PARENT_INJECTION_KEY;

    // Only provide / inject within a component setup context.
    //
    // - `detached: true` skips BOTH `inject()` and `provide()` — the
    //   composable is invisible to ancestors *and* descendants.
    // - `stopPropagation: true` skips `inject()` (won't register with a
    //   parent) but still calls `provide()` so descendants can register
    //   with this composable. The common "root of an aggregation tree" flag.
    const inComponent = getCurrentInstance() !== null;
    let parent: ParentRegistry | undefined;
    if (inComponent && !options.detached) {
        if (!options.stopPropagation) {
            parent = inject(ownInjectionKey, undefined);
        }
        provide(ownInjectionKey, ownRegistry);
    }

    return {
        childRegistry,
        attach(composable) {
            if (inComponent && parent && options.name) {
                parent.register(options.name, composable);
                if (getCurrentScope()) {
                    onScopeDispose(() => parent!.unregister(options.name as string));
                }
            }
        },
    };
}
