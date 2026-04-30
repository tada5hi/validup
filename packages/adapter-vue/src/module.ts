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
    toRaw,
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
} from 'validup';
import {
    IssueCode,
    ValidupError,
    isIssueGroup,
    isIssueItem,
    isValidupError,
} from 'validup';
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
    //
    // Caveat: top-level keys that *contain a dot* (e.g. `state['user.email']`
    // as a single literal key) are not addressable via this composable —
    // they collide with the dotted path syntax. This is an acknowledged
    // trade-off: vuelidate's path syntax has the same limitation, and form
    // state with literal-dot keys is vanishingly rare in practice.
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
    // Normalize MaybeRef explicitly — `toRef(maybeRef)` semantics shifted across
    // Vue 3.x minor versions; `isRef` keeps reactivity intact regardless.
    const groupRef = (isRef(options.group) ? options.group : ref(options.group)) as Ref<string | undefined>;

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
            let result: Result<T>;
            try {
                result = await c.safeRun(unref(stateRef) as Record<string, any>, { group: groupRef.value });
            } catch (rawError) {
                // Defensive: `safeRun` is contractually never supposed to throw,
                // but a buggy or wrapped `IContainer` implementation might.
                // Surface the throw as a synthetic `Result` failure so the
                // composable stays consistent (`$invalid`/`$errors` reflect it).
                const error = isValidupError(rawError) ?
                    rawError :
                    new ValidupError([{
                        type: 'item',
                        code: IssueCode.VALUE_INVALID,
                        path: [],
                        message: rawError instanceof Error ? rawError.message : String(rawError),
                    } as IssueItem]);
                result = { success: false, error } as Result<T>;
            }
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
        // `lazy` skips the on-mount probe — validation kicks in on the first
        // state change (which is what `$model` writes trigger naturally).
        { deep: true, immediate: !options.lazy },
    );

    if (options.autoDirty) {
        // Mark every top-level state key dirty whenever state changes from
        // any source (Pinia store action, programmatic write, …). Excludes
        // the initial mount because `immediate` is omitted.
        watch(
            stateRef,
            () => {
                const data = unref(stateRef) as Record<string, unknown> | null | undefined;
                if (data && typeof data === 'object') {
                    for (const key of Object.keys(data)) {
                        dirtyPaths.add(key);
                    }
                }
            },
            { deep: true },
        );
    }

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

    // Scoped parent/child injection — same-scope parents see same-scope
    // descendants; the unscoped key continues to behave as before.
    const ownInjectionKey = options.scope ?
        Symbol.for(`validup:parent:${options.scope}`) :
        PARENT_INJECTION_KEY;

    // Only provide / inject within a component setup context.
    //
    // - `detached: true` skips BOTH `inject()` and `provide()` — the
    //   composable is invisible to ancestors *and* descendants.
    // - `stopPropagation: true` skips `inject()` (won't register with a
    //   parent) but still calls `provide()` so descendants can register
    //   with this composable. This is the common "this is the root of an
    //   aggregation tree" flag.
    const inComponent = getCurrentInstance() !== null;
    let parent: ParentRegistry | undefined;
    if (inComponent && !options.detached) {
        if (!options.stopPropagation) {
            parent = inject(ownInjectionKey, undefined);
        }
        provide(ownInjectionKey, ownRegistry);
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

    function isUnderPath(itemPath: string, target: string): boolean {
        return itemPath === target || itemPath.startsWith(`${target}.`);
    }

    function pruneExternalAtPath(issues: Issue[], target: string): Issue[] {
        const output: Issue[] = [];
        for (const issue of issues) {
            const ip = pathKey(issue.path);
            if (isIssueGroup(issue)) {
                if (isUnderPath(ip, target)) {
                    // Whole group sits under the cleared path — drop it.
                    continue;
                }
                // The group itself is outside but its leaves may still match
                // (e.g. a top-level `oneOf` group contains a leaf at `name`).
                const inner = pruneExternalAtPath(issue.issues, target);
                if (inner.length === issue.issues.length) {
                    output.push(issue);
                } else if (inner.length > 0) {
                    output.push({ ...issue, issues: inner });
                }
                // empty group → drop entirely
                continue;
            }
            if (!isUnderPath(ip, target)) {
                output.push(issue);
            }
        }
        return output;
    }

    function clearExternalAtPath(path: string) {
        if (externalIssues.value.length === 0) {
            return;
        }
        externalIssues.value = pruneExternalAtPath(externalIssues.value, path);
    }

    // ---- per-field state ---------------------------------------------------

    function buildFieldState<V>(key: string): FieldState<V> {
        const segments = pathFromKey(key);
        const path = segments.join('.');

        const $model = computed<V>({
            get: () => readNested(unref(stateRef), segments) as V,
            set: (value) => {
                // Vuelidate parity: writing the same value back through `$model`
                // is a no-op for dirty tracking. Object.is matches Vue's own
                // change-detection (handles NaN === NaN, distinguishes ±0).
                const prev = readNested(toRaw(unref(stateRef)), segments);
                if (Object.is(prev, value)) {
                    return;
                }
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
    function getOrBuildFieldState(prop: string): FieldState<any> {
        let cached = fieldsCache.get(prop);
        if (!cached) {
            cached = buildFieldState(prop);
            fieldsCache.set(prop, cached);
        }
        return cached;
    }
    function liveStateKeys(): string[] {
        // Reads `stateRef.value` (not `toRaw`) so reactive effects that walk
        // `Object.keys(fields)` re-run when the underlying state object's
        // shape changes — adding/removing top-level keys is rare in form
        // state but does happen with conditional sub-forms.
        const data = stateRef.value as Record<string, unknown> | null | undefined;
        return data && typeof data === 'object' ? Object.keys(data) : [];
    }

    const fields = new Proxy({} as ValidupComposable<T>['fields'], {
        get(_, prop) {
            if (typeof prop !== 'string') {
                return undefined;
            }
            return getOrBuildFieldState(prop);
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
            // Returning a *data* descriptor with `value` (the field state) is
            // what `Object.keys(fields)` and the spread operator rely on to
            // surface the field. Reading `value` here goes through the proxy
            // cache so the same `FieldState` instance is reused.
            return {
                enumerable: true,
                configurable: true,
                writable: false,
                value: getOrBuildFieldState(prop),
            };
        },
    });

    // ---- form-level state --------------------------------------------------

    function markIssuePathsDirty() {
        // Container mounts may target paths that don't (yet) exist on the
        // state object — e.g. validating `address.city` when state starts as
        // `{}`, or any optional/nested object the user hasn't created yet.
        // Without this, `$errors` would stay empty after `$validate()` for
        // those paths because no state key matches.
        for (const item of flattenIssueItems([...internalIssues.value, ...externalIssues.value])) {
            if (item.path.length > 0) {
                dirtyPaths.add(pathKey(item.path));
            }
        }
    }

    function markStateKeysDirty() {
        const data = unref(stateRef) as Record<string, unknown> | null | undefined;
        if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
                dirtyPaths.add(key);
            }
        }
    }

    function $touch() {
        markStateKeysDirty();
        markIssuePathsDirty();
    }

    function $reset() {
        // Note: `internalIssues` is intentionally NOT cleared here.
        // `$reset()` returns the form to a "clean" UX state (no dirty paths,
        // no external errors), but the underlying invalidity is a property of
        // the current state — clearing internal issues would let `$invalid`
        // flicker false until the next run. Vuelidate behaves the same way.
        // To re-run validation after a reset, the caller should `$validate()`
        // (or wait for the next state change).
        dirtyPaths.clear();
        externalIssues.value = [];
    }

    async function $validate(): Promise<Result<T>> {
        // Cancel any pending debounced run — `$validate` is the explicit
        // submit-time check and must not race with a stale debounced result.
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = undefined;
        }
        // Eagerly mark every known state key dirty so the upcoming run's
        // results surface immediately. Issue paths from validation targets
        // outside the state object (e.g. `address.city` against `state = {}`)
        // are caught after the run completes via `markIssuePathsDirty()`.
        markStateKeysDirty();
        const result = await runOnce();
        markIssuePathsDirty();
        return result;
    }

    function tagExternal(issue: Issue): Issue {
        const meta = { ...(issue.meta ?? {}), external: true };
        if (isIssueGroup(issue)) {
            return {
                ...issue,
                meta,
                issues: issue.issues.map(tagExternal),
            };
        }
        return { ...issue, meta };
    }

    function setExternalIssues(issues: Issue[]) {
        externalIssues.value = issues.map(tagExternal);
    }

    const composable: ValidupComposable<T> = {
        $invalid: computed(() => internalIssues.value.length > 0 || externalIssues.value.length > 0),
        $pending: computed(() => pending.value),
        $dirty: computed(() => dirtyPaths.size > 0),
        $errors: computed(() => flattenIssueItems([...internalIssues.value, ...externalIssues.value])
            .filter((i) => i.path.length > 0 && isPrefixDirty(dirtyPaths, pathKey(i.path)))),
        $issues: computed(() => [...internalIssues.value, ...externalIssues.value]),
        // Path-less issues (cross-cutting failures like rate limit, CSRF, or
        // schema-level container errors) — always visible, no dirty gate.
        // Pulled from BOTH internal runs and `setExternalIssues` so a synthetic
        // failure raised by a defensive `runOnce` catch surfaces here too.
        $crossCuttingErrors: computed(() => flattenIssueItems([
            ...internalIssues.value,
            ...externalIssues.value,
        ]).filter((i) => i.path.length === 0)),
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

export { ValidupError, isValidupError };
