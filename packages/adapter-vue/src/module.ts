/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    computed, getCurrentInstance, getCurrentScope, inject, isRef, onScopeDispose, provide, reactive, ref, toRef, unref, watch,
} from 'vue';
import type { Ref } from 'vue';
import type {
    Issue, IssueItem, ObjectLiteral, Result, ValidupError,
} from 'validup';
import { isIssueItem, isValidupError } from 'validup';
import { PARENT_INJECTION_KEY } from './helpers/child';
import type {
    ContainerInput, FieldState, ParentRegistry, StateInput, ValidupComposable, ValidupComposableOptions,
} from './types';

function pathKey(path: PropertyKey[]): string {
    return path.map((p) => String(p)).join('.');
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
            const result = await c.safeRun(unref(stateRef) as Record<string, any>, {
                group: groupRef.value,
            });
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
        const path = key;

        const $model = computed<V>({
            get: () => (unref(stateRef) as Record<string, any>)[key] as V,
            set: (value) => {
                (unref(stateRef) as Record<string, any>)[key] = value;
                dirtyPaths.add(path);
                clearExternalAtPath(path);
            },
        });

        const items = computed(() => flatItemsAtPath(path));

        return {
            $model,
            $invalid: computed(() => items.value.length > 0),
            $pending: computed(() => pending.value),
            $dirty: computed(() => dirtyPaths.has(path)),
            $errors: computed(() => (dirtyPaths.has(path) ? items.value : [])),
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
            .filter((i) => {
                const head = String(i.path[0] ?? '');
                return dirtyPaths.has(head);
            })),
        $issues: computed(() => [...internalIssues.value, ...externalIssues.value]),
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
