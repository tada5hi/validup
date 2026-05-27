/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldState, Severity } from '../types';

/**
 * Map a per-field state to a presentational severity token.
 *
 * Mapping:
 * - not yet `$dirty`             → `undefined` (don't render anything)
 * - `$dirty` + `$pending`        → `'warning'` (validation in flight)
 * - `$dirty` + `$invalid`:
 *     - any error from a non-optional mount → `'error'` (hard failure —
 *       the schema requires this field, so the user must fix it)
 *     - all errors from optional mounts     → `'warning'` (soft failure —
 *       the user could have left the field blank; surfaced as a hint rather
 *       than a blocker)
 * - `$dirty` + valid             → `'success'`
 *
 * "Optional" is inferred from `IssueItem.meta.optional`, which the validup
 * runtime stamps on issues emitted from mounts declared as `optional: true`.
 * Child-container issues retain their own per-mount tagging (Option B —
 * the parent's optional flag does not bleed down into the child's required
 * fields), so a required inner field inside an optional sub-form still
 * surfaces as `'error'`.
 */
export function getSeverity(state: FieldState<any>): Severity {
    if (!state.$dirty.value) {
        return undefined;
    }
    if (state.$pending.value) {
        return 'warning';
    }
    if (state.$invalid.value) {
        const errors = state.$errors.value;
        const hasRequiredError = errors.some((e) => !e.meta?.optional);
        return hasRequiredError ? 'error' : 'warning';
    }
    return 'success';
}
