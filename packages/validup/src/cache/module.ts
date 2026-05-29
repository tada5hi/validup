/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IValidationCache, ValidationCacheEntry } from './types';

/**
 * Default in-memory {@link IValidationCache} implementation.
 *
 * Backed by a two-level `Map`:
 * - outer key — Mount reference (opaque object)
 * - inner key — expanded path (string)
 *
 * `Map` is used for both levels (rather than a `WeakMap` on the outer)
 * so `clear()` is supported. Cache entries become unreachable when the
 * owning composable / caller drops its reference to the
 * `ValidationCache` instance; in the typical `@validup/vue` flow that
 * happens on `onScopeDispose`, which lines up with component unmount.
 *
 * Snapshot equality (the "is this still valid?" check) is the run
 * loop's job — see `container/module.ts`. This class is dumb storage.
 */
export class ValidationCache implements IValidationCache {
    private store: Map<object, Map<string, ValidationCacheEntry>>;

    constructor() {
        this.store = new Map();
    }

    get(mount: object, key: string): ValidationCacheEntry | undefined {
        return this.store.get(mount)?.get(key);
    }

    set(mount: object, key: string, entry: ValidationCacheEntry): void {
        let inner = this.store.get(mount);
        if (!inner) {
            inner = new Map();
            this.store.set(mount, inner);
        }
        inner.set(key, entry);
    }

    delete(mount: object, key?: string): void {
        if (typeof key === 'undefined') {
            this.store.delete(mount);
            return;
        }
        const inner = this.store.get(mount);
        if (!inner) {
            return;
        }
        inner.delete(key);
        if (inner.size === 0) {
            this.store.delete(mount);
        }
    }

    clear(): void {
        this.store.clear();
    }
}
