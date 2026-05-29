/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupError, isError, isValidupError } from '../error';
import { IssueCode, defineIssueItem } from '../issue';
import type { Issue } from '../issue';
import type { Validator } from '../types';

export interface ComposeOptions {
    /**
     * Controls failure handling. Both modes thread each stage's return
     * into the next as `ctx.value` — they differ only in what happens
     * on a failure.
     *
     * - `true` **(default)** — **fail-fast.** The first failing
     *   validator stops the chain; the thrown error bubbles up
     *   unchanged.
     *
     * - `false` — **collect-all.** Every validator runs, even after a
     *   previous one threw; failures are collected and aggregated
     *   into a single `ValidupError` with multiple issues. Useful for
     *   submit-time error UIs that surface every broken rule in one
     *   pass. When a validator throws, the upstream value continues
     *   downstream (the failing stage isn't allowed to retro-actively
     *   mutate it).
     *
     * **Threading rule (both modes).** A validator's return value
     * replaces the threaded `ctx.value` only when it's defined.
     * `undefined` is treated as a pass-through — the upstream value
     * continues down the chain, so pure checks that don't bother
     * re-emitting `ctx.value` compose cleanly with transformers.
     * Validators that DO want to explicitly clear the field must
     * throw or return a sentinel.
     */
    bail?: boolean;
}

/**
 * Compose multiple validators into a single `Validator`.
 *
 * Validators run in order; each stage's return value feeds the next
 * as `ctx.value`. A stage that returns `undefined` is treated as a
 * pass-through (upstream value continues down the chain), so pure
 * checks that don't re-emit `ctx.value` compose cleanly with
 * transformers. `bail: true` (default) stops at the first failure;
 * `bail: false` collects every failure into a single `ValidupError`.
 *
 * @example
 *     // Fail-fast (default) — sanitize then validate
 *     container.mount('email', compose([
 *         trim(),
 *         isEmail(),
 *         isLength({ max: 254 }),
 *     ]));
 *
 *     // Collect-all — surface every broken rule for a richer error UI
 *     container.mount('password', compose([
 *         isLength({ min: 8 }),
 *         isAlphanumeric(),
 *         matches(/[0-9]/),
 *     ], { bail: false }));
 *
 * Throws that aren't `ValidupError` / `Error` (raw strings, plain
 * objects, null) are synthesized into a single `IssueItem` so the
 * aggregate is never silently missing a contributing failure — mirrors
 * `Container.recordMountError`'s defensive behavior.
 */
export function compose<C = unknown>(
    validators: Validator<C>[],
    options: ComposeOptions = {},
): Validator<C> {
    const bail = options.bail ?? true;

    return async (ctx) => {
        const issues: Issue[] = [];
        let { value } = ctx;

        for (const validator of validators) {
            try {
                // Spread a fresh ctx per stage so the threaded value
                // doesn't leak back to the caller via the input
                // reference — callers that compose inside their own
                // validator can keep reading `ctx.value` after the
                // composed call returns without seeing the post-thread
                // mutation.
                const result = await validator({ ...ctx, value });
                if (typeof result !== 'undefined') {
                    value = result;
                }
            } catch (e) {
                if (bail) {
                    throw e;
                }

                // Failing stage doesn't get to mutate the threaded
                // value — `value` keeps whatever the last successful
                // stage produced, so the next validator runs against a
                // well-defined input.
                if (isValidupError(e)) {
                    for (const issue of e.issues) {
                        issues.push(issue);
                    }
                    continue;
                }

                if (isError(e)) {
                    issues.push(defineIssueItem({
                        path: [],
                        code: IssueCode.VALUE_INVALID,
                        message: e.message,
                    }));
                    continue;
                }

                issues.push(defineIssueItem({
                    path: [],
                    code: IssueCode.VALUE_INVALID,
                    message: typeof e === 'string' && e.length > 0 ?
                        e :
                        `Non-Error throw: ${String(e)}`,
                }));
            }
        }

        if (issues.length > 0) {
            throw new ValidupError(issues);
        }

        return value;
    };
}
