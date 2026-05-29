/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The three context fields that determine a cached validator's output.
 * Equality is checked by the run loop with `Object.is` (so primitives
 * compare by value, objects/arrays/functions by reference) — a
 * non-side-effect validator's contract is that these three values
 * fully determine its result, so a fresh object literal in `context`
 * invalidates the cache even when its contents are equivalent.
 */
export type ResultCacheSnapshot = {
    value: unknown,
    context: unknown,
    group: string | undefined,
};

/**
 * Raw outcome of a validator invocation, captured before any
 * issue-path post-processing the surrounding run loop performs.
 *
 * The cache stores the validator's *return value* (success) or
 * *thrown error* (failure) — NOT the processed `Issue[]`. On replay,
 * the run loop rebuilds issues via `collectExecutionFailure` using
 * the current `keyParts`, so the same cache entry can be reused
 * correctly across runs where the parent `options.path` differs
 * (e.g. the same container mounted in two different parents).
 */
export type ResultCacheOutcome = { ok: true, value: unknown } |
    { ok: false, error: unknown };

/**
 * One cache slot for a (mount, expanded-key) pair. Stores the
 * snapshot used to gate reuse and the raw outcome to replay.
 */
export type ResultCacheEntry = {
    snapshot: ResultCacheSnapshot,
    outcome: ResultCacheOutcome,
};

/**
 * Storage contract for the per-mount result cache. Treated as opaque
 * key/value storage by the run loop — comparison logic (snapshot
 * equality, side-effect bypass) lives in the container, not the cache.
 *
 * Implementations are free to add LRU eviction, TTLs, persistence,
 * etc. on top of the default Map-backed {@link ResultCache}.
 *
 * Keys are (mount, expanded-key) pairs:
 * - `mount` is the framework-internal Mount reference (treated as an
 *   opaque object); use a `WeakMap` keyed on it so cache entries are
 *   GC'd alongside the owning container.
 * - `expanded-key` is the dotted path produced by `pathtrace`'s
 *   `expandPath` for the current run — wildcard mounts produce
 *   multiple expanded keys per registration, each needing its own
 *   slot.
 */
export interface IResultCache {
    get(mount: object, key: string): ResultCacheEntry | undefined;
    set(mount: object, key: string, entry: ResultCacheEntry): void;
    /**
     * Remove a single (mount, key) entry. When `key` is omitted, drop
     * every entry for the mount (useful when a mount is being
     * structurally invalidated).
     */
    delete(mount: object, key?: string): void;
    clear(): void;
}
