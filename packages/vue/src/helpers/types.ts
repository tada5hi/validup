import type { ObjectLiteral } from 'validup';
import { 
    inject, 
    onScopeDispose, 
    provide, 
    shallowReactive, 
} from 'vue';
import type { Composable } from '../types';


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

export type Collector = {
    /**
     * Live map of name → composable for child forms that registered with
     * this collector. `shallowReactive` (not `reactive()`) on purpose —
     * lookups via `$getResultsForChild` track the map, so a parent template
     * or `computed` re-evaluates when a child registers/unregisters, while
     * the shallow wrapper returns stored values raw and therefore does NOT
     * unwrap the nested refs in the child composable's public type.
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
