/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    computed, 
    getCurrentInstance, 
    getCurrentScope, 
    inject, 
    isRef, 
    onScopeDispose, 
    provide, 
    reactive, 
    ref, 
    toRef, 
    unref, 
    watch,
} from 'vue';
import type { Ref } from 'vue';
import type {
    Issue,
    IssueGroup,
    IssueItem,
    ObjectLiteral,
    Result,
    ValidupError,
} from 'validup';
import { isIssueGroup, isIssueItem, isValidupError } from 'validup';
import { PARENT_INJECTION_KEY } from './helpers/child';
import type {
    ContainerInput, 
    FieldState, 
    ParentRegistry, 
    StateInput, 
    ValidupComposable, 
    ValidupComposableOptions,
} from './types';

function pathKey(path: PropertyKey[]): string {
    return path.map((p) => String(p)).join('.');
}

function pathFromKey(key: string): string[] {
    // Accepts dotted (`a.b.c`), bracketed (`a[0].b`), or mixed (`a.b[0].c`).
    return key
        .replace(/\[(\w+)\]/g, '.$1')
        .split('.')
        .filter((s) => s.length > 0);
}

function readNested(obj: any, segments: string[]): unknown {
    let cur: any = obj;
    for (const seg of segments) {
        if (cur == null) {
            return undefined;
        }
        cur = cur[seg];
    }
    return cur;
}

function writeNested(obj: any, segments: string[], value: unknown): void {
    if (segments.length === 0) {
        return;
    }
    let cur: any = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (cur[seg] == null || typeof cur[seg] !== 'object') {
            cur[seg] = /^\d+$/.test(segments[i + 1] as string) ? [] : {};
        }
        cur = cur[seg];
    }
    cur[segments[segments.length - 1] as string] = value;
}

function isPrefixDirty(dirtyPaths: ReadonlySet<string>, key: string): boolean {
    if (dirtyPaths.has(key)) {
        return true;
    }
    const segments = key.split('.');
    for (let n = 1; n < segments.length; n++) {
        if (dirtyPaths.has(segments.slice(0, n).join('.'))) {
            return true;
        }
    }
    return false;
}

function flattenIssueItems(issues: Issue[]): IssueItem[] {
    const output: IssueItem[] = [];
    for (const issue of issues) {
        if (isIssueItem(issue)) {
            output.push(issue);
        } else {
            output.push(...flattenIssueItems(issue.issues));
        }
    }
    return output;
}

function flattenIssueGroups(issues: Issue[]): IssueGroup[] {
    const output: IssueGroup[] = [];
    for (const issue of issues) {
        if (isIssueGroup(issue)) {
            output.push(issue);
            output.push(...flattenIssueGroups(issue.issues));
        }
    }
    return output;
}

export function useValidup<T extends ObjectLiteral = ObjectLiteral>(
    container: ContainerInput<T>,
    state: StateInput<T>,
    options: ValidupComposableOptions<T> = {},
): ValidupComposable<T> {
    const containerRef = (isRef(container) ? container : ref(container)) as Ref<any>;
    const stateRef = (isRef(state) ? state : ref(state)) as Ref<T>;
    const groupRef = toRef(options.group ?? undefined) as Ref<string | undefined>;

    const dirtyPaths = reactive<Set<string>>(new Set());
    const internalIssues = ref<Issue[]>([]);
    const externalIssues = ref<Issue[]>([]);
    const pending = ref(false);

    let runId = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    async function runOnce(): Promise<Result<T>> {
        const id = ++runId;
        pending.value = true;
        try {
            const c = unref(containerRef);
            const result = await c.safeRun(unref(stateRef) as Record<string, any>, { group: groupRef.value });
            if (id !== runId) {
                return result;
            }
            internalIssues.value = result.success ? [] : result.error.issues;
            return result;
        } finally {
            if (id === runId) {
                pending.value = false;
            }
        }
    }

    function schedule() {
        if (options.debounce && options.debounce > 0) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                void runOnce();
            }, options.debounce);
            return;
        }
        void runOnce();
    }

    watch(
        [containerRef, groupRef, stateRef],
        () => {
            schedule();
        },
        { deep: true, immediate: true },
    );

    // ---- nested form registry ----------------------------------------------
    // Plain Map (not reactive) — `$getResultsForChild` is consumed imperatively
    // (e.g. inside a submit handler), and Vue's `reactive()` would unwrap the
    // child composable's refs, mangling the public type.

    const childRegistry = new Map<string, ValidupComposable<any>>();

    const ownRegistry: ParentRegistry = {
        register(name, child) {
            childRegistry.set(name, child);
        },
        unregister(name) {
            childRegistry.delete(name);
        },
    };

    // Only provide / inject within a component setup context.
    const inComponent = getCurrentInstance() !== null;
    let parent: ParentRegistry | undefined;
    if (inComponent) {
        if (!options.detached && !options.stopPropagation) {
            parent = inject(PARENT_INJECTION_KEY, undefined);
        }
        provide(PARENT_INJECTION_KEY, ownRegistry);
    }

    // ---- per-path issue selection ------------------------------------------

    function flatItemsAtPath(path: string): IssueItem[] {
        const all = [...internalIssues.value, ...externalIssues.value];
        const flat = flattenIssueItems(all);
        if (path === '') {
            return flat;
        }
        return flat.filter((i) => {
            const ip = pathKey(i.path);
            return ip === path || ip.startsWith(`${path}.`);
        });
    }

    function rawIssuesAtPath(path: string): Issue[] {
        const all = [...internalIssues.value, ...externalIssues.value];
        if (path === '') {
            return all;
        }
        return all.filter((i) => {
            const ip = pathKey(i.path);
            return ip === path || ip.startsWith(`${path}.`);
        });
    }

    function clearExternalAtPath(path: string) {
        if (externalIssues.value.length === 0) {
            return;
        }
        externalIssues.value = externalIssues.value.filter((i) => {
            const ip = pathKey(i.path);
            return ip !== path && !ip.startsWith(`${path}.`);
        });
    }

    // ---- per-field state ---------------------------------------------------

    function buildFieldState<V>(key: string): FieldState<V> {
        const segments = pathFromKey(key);
        const path = segments.join('.');

        const $model = computed<V>({
            get: () => readNested(unref(stateRef), segments) as V,
            set: (value) => {
                writeNested(unref(stateRef), segments, value);
                dirtyPaths.add(path);
                clearExternalAtPath(path);
            },
        });

        const items = computed(() => flatItemsAtPath(path));

        return {
            $model,
            $invalid: computed(() => items.value.length > 0),
            $pending: computed(() => pending.value),
            $dirty: computed(() => isPrefixDirty(dirtyPaths, path)),
            $errors: computed(() => (isPrefixDirty(dirtyPaths, path) ? items.value : [])),
            $issues: computed(() => rawIssuesAtPath(path)),
            $touch: () => {
                dirtyPaths.add(path);
            },
            $reset: () => {
                dirtyPaths.delete(path);
                clearExternalAtPath(path);
            },
        };
    }

    const fieldsCache = new Map<string, FieldState<any>>();
    function liveStateKeys(): string[] {
        const data = unref(stateRef) as Record<string, unknown> | null | undefined;
        return data && typeof data === 'object' ? Object.keys(data) : [];
    }

    const fields = new Proxy({} as ValidupComposable<T>['fields'], {
        get(_, prop) {
            if (typeof prop !== 'string') {
                return undefined;
            }
            let cached = fieldsCache.get(prop);
            if (!cached) {
                cached = buildFieldState(prop);
                fieldsCache.set(prop, cached);
            }
            return cached;
        },
        has(_, prop) {
            return typeof prop === 'string' && liveStateKeys().includes(prop);
        },
        ownKeys() {
            return liveStateKeys();
        },
        getOwnPropertyDescriptor(_, prop) {
            if (typeof prop !== 'string' || !liveStateKeys().includes(prop)) {
                return undefined;
            }
            return {
                enumerable: true,
                configurable: true,
                writable: false,
                value: undefined,
            };
        },
    });

    // ---- form-level state --------------------------------------------------

    function $touch() {
        const data = unref(stateRef) as Record<string, unknown> | null | undefined;
        if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
                dirtyPaths.add(key);
            }
        }
    }

    function $reset() {
        dirtyPaths.clear();
        externalIssues.value = [];
    }

    function $validate(): Promise<Result<T>> {
        // Cancel any pending debounced run — `$validate` is the explicit
        // submit-time check and must not race with a stale debounced result.
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = undefined;
        }
        $touch();
        return runOnce();
    }

    function setExternalIssues(issues: Issue[]) {
        externalIssues.value = issues.map((i) => ({
            ...i,
            meta: { ...(i.meta ?? {}), external: true },
        }));
    }

    const composable: ValidupComposable<T> = {
        $invalid: computed(() => internalIssues.value.length > 0 || externalIssues.value.length > 0),
        $pending: computed(() => pending.value),
        $dirty: computed(() => dirtyPaths.size > 0),
        $errors: computed(() => flattenIssueItems([...internalIssues.value, ...externalIssues.value])
            .filter((i) => i.path.length > 0 && isPrefixDirty(dirtyPaths, pathKey(i.path)))),
        $issues: computed(() => [...internalIssues.value, ...externalIssues.value]),
        // Path-less issues (cross-cutting failures like rate limit, CSRF) are
        // always visible — no dirty gate, no field to attach to.
        $externalErrors: computed(() => flattenIssueItems(externalIssues.value)
            .filter((i) => i.path.length === 0)),
        // Group-level issues (e.g. ONE_OF_FAILED). Empty-path groups surface
        // once any field is dirty; nested groups gate on prefix-dirty rules.
        $groupErrors: computed(() => flattenIssueGroups([...internalIssues.value, ...externalIssues.value])
            .filter((g) => {
                if (g.path.length === 0) {
                    return dirtyPaths.size > 0;
                }
                return isPrefixDirty(dirtyPaths, pathKey(g.path));
            })),
        $touch,
        $reset,
        $validate,
        setExternalIssues,
        $getResultsForChild: <C extends ObjectLiteral = ObjectLiteral>(name: string) => childRegistry.get(name) as ValidupComposable<C> | undefined,
        fields,
    };

    if (inComponent && parent && options.name) {
        parent.register(options.name, composable);
        if (getCurrentScope()) {
            onScopeDispose(() => parent!.unregister(options.name as string));
        }
    }

    return composable;
}

export { isValidupError };
export type { ValidupError };
