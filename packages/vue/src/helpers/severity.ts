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
 * Mapping (reads `$errors`, which is already "visible items" — see
 * `useValidup`'s `isIssueItemVisible` helper):
 *
 * - `$pending`                                         → `'warning'`
 * - has any visible error from a non-optional mount    → `'error'` when
 *   the field is `$dirty`, `'warning'` when still pristine (the form
 *   communicates "there is work to do" before the user touches anything)
 * - has visible errors but all from optional mounts    → `'warning'`
 *   (the user could leave the field blank; surfaced as a hint, never as
 *   a blocker)
 * - no visible errors and `$dirty`                     → `'success'`
 * - no visible errors and not `$dirty`                 → `undefined`
 *
 * "Optional" is inferred from `IssueItem.meta.optional`, which the validup
 * runtime stamps on issues emitted from mounts declared as `optional: true`.
 * Child-container issues retain their own per-mount tagging (Option B —
 * the parent's optional flag does not bleed down into the child's required
 * fields), so a required inner field inside an optional sub-form still
 * surfaces as `'error'`.
 *
 * Because `$errors` already filters optional-mount items pre-touch,
 * consumers using `field.$errors.value.map((i) => i.message)` for rendering
 * automatically pair with the severity returned here — no `$issues` walk
 * required.
 */
export function getSeverity(state: FieldState<any>): Severity {
    if (state.$pending.value) {
        return 'warning';
    }
    const errors = state.$errors.value;
    if (errors.length === 0) {
        return state.$dirty.value ? 'success' : undefined;
    }
    const hasRequiredError = errors.some((e) => !e.meta?.optional);
    if (!state.$dirty.value) {
        // Pre-touch — `$errors` only contains required-mount items here
        // (optional ones are filtered by `isIssueItemVisible`), so any
        // entry means there's work to do. Surface as warning, not error:
        // the user hasn't engaged yet, this is a hint not a blocker.
        return hasRequiredError ? 'warning' : undefined;
    }
    return hasRequiredError ? 'error' : 'warning';
}
