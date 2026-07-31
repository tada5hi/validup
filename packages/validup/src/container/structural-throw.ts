/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isPathsStrictViolation } from './paths-strict-violation';
import { isRunSyncViolation } from './run-sync-violation';

/**
 * Should this thrown value escape the issue-folding path verbatim?
 *
 * Three unrelated reasons say yes, and every site in `Container` that folds a
 * throw into `Issue[]` has to ask all three. Collapsing them into one predicate
 * keeps the list in a single place — a fourth carve-out is one edit, not three.
 *
 * 1. **The run was cancelled.** `signal.aborted` is a *run-state* read, not a
 *    property of `error`. During an aborted run the thrown value is re-raised
 *    **as-is** — it is NOT necessarily `signal.reason`, because a mid-flight
 *    validator may throw its own error before the next abort check fires. That
 *    contract is public (see the `@throws` block on {@link Container.run}), so
 *    this leg must stay a signal read and must never become an
 *    `isAbortError(error)` test.
 * 2. **`RunSyncViolationError`.** Structural: the caller cannot use `runSync`
 *    against this graph. Folding it in would surface "Property X is invalid"
 *    instead of the diagnostic.
 * 3. **`PathsStrictViolationError`.** Structural: the validator graph is
 *    misconfigured (a `pathsToInclude` / `pathsToExclude` entry matched no
 *    mount), not the input. It reaches a parent's per-mount catch because the
 *    child `run()` is awaited inside the `try`.
 *
 * Both error legs delegate to the duck-typed guards rather than `instanceof`,
 * so a throw crossing a realm boundary or originating from a duplicate copy of
 * the package is still recognised.
 *
 * **Name caveat.** "Structural" describes legs 2 and 3 exactly; leg 1 is run
 * state, so an aborted run makes this return `true` for *any* value —
 * including a plain validation `ValidupError` from a validator that finished
 * just before the abort landed. The name is kept for continuity with the
 * comments it replaces; read it as "must not be folded into issues", not as a
 * statement about the error's type.
 *
 * Deliberately **not** a type predicate: the abort leg is true for arbitrary
 * values, so `error is RunSyncViolationError | PathsStrictViolationError` would
 * be an unsound narrowing. Every current caller re-throws immediately, but a
 * future one might not.
 *
 * Internal — not exported from `container/index.ts`, and therefore not from the
 * package barrel. It composes `isRunSyncViolation`, which is deliberately
 * private; publishing the composite would leak that decision into the public,
 * semver-protected surface.
 */
export function isStructuralThrow(error: unknown, signal?: AbortSignal): boolean {
    return Boolean(signal?.aborted) ||
        isRunSyncViolation(error) ||
        isPathsStrictViolation(error);
}
