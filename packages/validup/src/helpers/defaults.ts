/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Slice a parent `defaults` map down to entries that target paths inside a
 * single nested container mount, with the mount-key prefix stripped so the
 * child sees them as local keys. Exact-key matches (the default targets the
 * mount root itself) are skipped — the parent's post-loop fill handles those
 * once the child has returned, since the child is run with `flat: true` and
 * cannot address its own root.
 */
export function resolveDefaults(
    defaults: Record<string, any> | undefined,
    key: string,
): Record<string, any> | undefined {
    if (typeof defaults === 'undefined') {
        return undefined;
    }
    if (key.length === 0) {
        return defaults;
    }

    const output: Record<string, any> = {};
    let matched = false;
    const keys = Object.keys(defaults);
    for (const k of keys) {
        if (k.startsWith(`${key}.`)) {
            output[k.slice(key.length + 1)] = defaults[k];
            matched = true;
        }
    }
    return matched ? output : undefined;
}
