/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ValidupError, isValidupError } from '../error';
import { defineIssueItem } from '../issue';
import type { Issue } from '../issue';
import type { Validator } from '../types';

export interface ComposeOptions {
    /**
     * Controls failure handling.
     *
     * - `true` **(default)** — **fail-fast.** The first failing validator
     *   stops the chain; the thrown error bubbles up unchanged. Each
     *   validator's output feeds the next as `ctx.value`, so
     *   sanitize-then-validate patterns work (`trim()` → `isEmail()`).
     *
     * - `false` — **collect-all.** Every validator runs against the
     *   original `ctx.value` (no threading); failures are collected and
     *   aggregated into a single `ValidupError` with multiple issues.
     *   Useful for submit-time error UIs that surface every broken rule
     *   in one pass.
     *
     * The threading semantic is coupled to bail behavior on purpose: a
     * `bail: false` chain that threads would re-validate a transformed
     * value the consumer didn't expect to be transformed.
     */
    bail?: boolean;
}

/**
 * Compose multiple validators into a single `Validator`.
 *
 * Default (`bail: true`) runs validators in order and stops at the first
 * failure; each validator's output feeds the next. Pass `bail: false` to
 * run every validator against the original `ctx.value` and aggregate all
 * failures into one `ValidupError`.
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

    if (bail) {
        return async (ctx) => {
            let { value } = ctx;
            for (const validator of validators) {
                value = await validator({ ...ctx, value });
            }
            return value;
        };
    }

    return async (ctx) => {
        const issues: Issue[] = [];

        for (const validator of validators) {
            try {
                await validator(ctx);
            } catch (e) {
                if (isValidupError(e)) {
                    for (const issue of e.issues) {
                        issues.push(issue);
                    }
                    continue;
                }
                if (e instanceof Error) {
                    issues.push(defineIssueItem({
                        path: [],
                        message: e.message,
                    }));
                    continue;
                }
                issues.push(defineIssueItem({
                    path: [],
                    message: typeof e === 'string' && e.length > 0 ?
                        e :
                        `Non-Error throw: ${String(e)}`,
                }));
            }
        }

        if (issues.length > 0) {
            throw new ValidupError(issues);
        }
        return ctx.value;
    };
}
