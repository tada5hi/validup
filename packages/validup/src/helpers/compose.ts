/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isContainer } from '../container/check';
import type { IContainer } from '../container/types';
import { ValidupError } from '../error';
import type { Issue } from '../issue';
import type { Validator, ValidatorContext } from '../types';
import { isObject } from '../utils';
import { errorToIssues } from './error-to-issues';
import { buildOneOfFailedGroup } from './one-of-failed';

/**
 * A composable element — either a bare `Validator<C>` function or a
 * fully-built `IContainer<T, C>` instance. Containers participate
 * with the same contract as validators (transform-or-throw); the
 * dispatcher (`invokeComposeElement`) hides the call-shape difference.
 *
 * `IContainer<any, any>` (rather than something tighter) keeps the
 * compose array heterogeneous — a chain can mix schemas / containers
 * with different output shapes without forcing the caller to widen
 * generics at every call site. The cost is that the composed
 * `Validator`'s `Out` defaults to `unknown` (same as before).
 */
export type ComposeElement<C = unknown> = Validator<C> | IContainer<any, any>;

/**
 * Options for {@link compose}. Discriminated on `oneOf` so the type
 * surface enforces the (`bail` × `oneOf`) combinations that actually
 * make sense:
 *
 * - `{}` / `{ bail?: boolean }` / `{ oneOf: false }` — the **all**
 *   strategy: every validator must pass, stages thread their return
 *   value into the next, `bail` controls fail-fast vs. collect-all.
 * - `{ oneOf: true }` — the **any-of** strategy: the first branch to
 *   succeed wins and the composed validator returns its value;
 *   `bail` is rejected at compile time because there's no chain to
 *   bail out of.
 */
export type ComposeOptions = {
    /**
     * Run every validator and require all to pass (default). Stages
     * thread their return into the next; `bail` controls whether the
     * first failure stops the chain (`true`, default) or every failure
     * is collected into one aggregate `ValidupError` (`false`).
     *
     * **Threading rule.** A stage's return replaces the threaded
     * `ctx.value` only when defined — `undefined` is treated as a
     * pass-through so pure checks that don't re-emit `ctx.value`
     * compose cleanly with transformers. Stages that DO want to
     * explicitly clear the field must throw or return a sentinel.
     */
    oneOf?: false,
    bail?: boolean,
} | {
    /**
     * Run branches as alternatives in registration order — the first
     * one to succeed wins, subsequent branches are not invoked, and
     * the composed validator returns the winning branch's value
     * (falling back to `ctx.value` if the winning branch returned
     * `undefined`). When *every* branch fails, the composed validator
     * throws a `ValidupError` whose first issue is an `IssueGroup`
     * with `code: IssueCode.ONE_OF_FAILED` carrying every branch's
     * collected failures (per-branch index surfaced via
     * `params: { branch }`). Symmetric with
     * `Container.options.oneOf`, just at the validator level.
     *
     * Each branch sees the original `ctx.value` — no threading
     * across alternatives, since branches aren't a pipeline.
     * `bail` is intentionally rejected at the type level under this
     * mode: there's no chain to fail-fast over.
     */
    oneOf: true,
};

/**
 * Compose multiple validators into a single `Validator`.
 *
 * Default (`oneOf: false`) — validators run in order; each stage's
 * return value feeds the next as `ctx.value`. A stage that returns
 * `undefined` is treated as a pass-through (upstream value continues
 * down the chain), so pure checks that don't re-emit `ctx.value`
 * compose cleanly with transformers. `bail: true` (default) stops at
 * the first failure; `bail: false` collects every failure into a
 * single `ValidupError`.
 *
 * `oneOf: true` — branches run as alternatives in registration order;
 * the first branch to succeed wins and subsequent branches are not
 * invoked. When every branch fails, the composed validator throws a
 * `ValidupError` whose first issue is an `IssueGroup` with
 * `code: IssueCode.ONE_OF_FAILED` carrying every branch's failures.
 *
 * Elements can be bare `Validator<C>` functions OR fully-built
 * `IContainer<T, C>` instances — the dispatcher detects which and
 * either calls the function with the threaded `ctx` or invokes the
 * container's `run(value, { group, context, signal, path })` with
 * the threaded value as input. Containers participate with the same
 * transform-or-throw contract; their output replaces the threaded
 * value in the all-strategy chain, and a successful container wins
 * the branch in `oneOf` mode.
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
 *     // Any-of — accept either an email or a phone number on the same field
 *     container.mount('contact', compose([
 *         isEmail(),
 *         isMobilePhone(),
 *     ], { oneOf: true }));
 *
 *     // Any-of with a container branch — accept a contact string OR a
 *     // nested address object validated by its own container.
 *     container.mount('contact', composeOneOf([
 *         isEmail(),
 *         isMobilePhone(),
 *         addressContainer,
 *     ]));
 *
 * Throws that aren't `ValidupError` / `Error` (raw strings, plain
 * objects, null) are synthesized into a single `IssueItem` so the
 * aggregate is never silently missing a contributing failure — mirrors
 * `Container.recordMountError`'s defensive behavior.
 */
export function compose<C = unknown>(
    elements: ComposeElement<C>[],
    options: ComposeOptions = {},
): Validator<C> {
    if (options.oneOf === true) {
        return composeAnyOf(elements);
    }

    const bail = options.bail ?? true;

    return async (ctx) => {
        const issues: Issue[] = [];
        let { value } = ctx;

        for (const element of elements) {
            try {
                // Spread a fresh ctx per stage so the threaded value
                // doesn't leak back to the caller via the input
                // reference — callers that compose inside their own
                // validator can keep reading `ctx.value` after the
                // composed call returns without seeing the post-thread
                // mutation.
                const result = await invokeComposeElement(element, { ...ctx, value });
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
                // well-defined input. Use the shared `errorToIssues`
                // cascade so the ValidupError / Error / non-Error fold
                // stays in lockstep with composeAnyOf and other
                // call sites.
                for (const issue of errorToIssues(e)) {
                    issues.push(issue);
                }
            }
        }

        if (issues.length > 0) {
            throw new ValidupError(issues);
        }

        return value;
    };
}

/**
 * Sugar for `compose(elements, { oneOf: true })`. Reads more
 * naturally at the call site when the alternative semantic is the
 * intent, mirrors `Container`'s own `oneOf` option.
 */
export function composeOneOf<C = unknown>(
    elements: ComposeElement<C>[],
): Validator<C> {
    return compose(elements, { oneOf: true });
}

/**
 * The `oneOf` execution path. Carved out so `compose`'s body stays
 * focused on the all-strategy chain and so the abort / per-branch
 * issue plumbing has somewhere to live without nesting.
 *
 * Each branch sees the original `ctx.value` (no threading across
 * alternatives). The first defined return wins; an `undefined` return
 * from a successful branch falls back to `ctx.value` so the
 * pass-through rule stays symmetric with the all-strategy path.
 *
 * Aborts are re-raised verbatim from inside the try (matches Container
 * behavior): a cancelled run isn't a validation outcome to wrap.
 */
function composeAnyOf<C>(elements: ComposeElement<C>[]): Validator<C> {
    return async (ctx) => {
        const branchIssues: Issue[] = [];

        for (const [index, element] of elements.entries()) {
            // Pre-branch abort check — short-circuits cleanly before we
            // enter the per-branch try/catch, so aborts never get
            // rewritten into branch-failure issues.
            ctx.signal?.throwIfAborted();

            try {
                const result = await invokeComposeElement(element, { ...ctx });
                // First branch to succeed wins — pass-through rule:
                // if the winning branch didn't bother re-emitting
                // `ctx.value`, surface the input as the output.
                return typeof result === 'undefined' ? ctx.value : result;
            } catch (e) {
                // Cancellations from a branch validator surface
                // verbatim instead of being folded into a branch
                // failure — caller can distinguish "no branch matched"
                // from "operation cancelled".
                if (ctx.signal?.aborted) {
                    throw e;
                }

                const wrapped = wrapBranchIssues(e, index);
                for (const issue of wrapped) {
                    branchIssues.push(issue);
                }
            }
        }

        // Every branch (including the empty-branch-list case) failed.
        // Use the shared `buildOneOfFailedGroup` so consumers /
        // i18n catalogs handle compose's any-of the same way they
        // handle `Container.options.oneOf`.
        throw new ValidupError([buildOneOfFailedGroup(branchIssues)]);
    };
}

/**
 * Dispatch one compose element against the current `ctx`. Containers
 * receive `ctx.value` as their input (normalised to `{}` for non-object
 * values, mirroring how the `Container.run` loop handles a nested
 * container mounted against a non-object value); validators receive
 * `ctx` itself.
 *
 * Forwarded to the child container's `run`:
 *
 * - `group`, `context`, `signal` — the threaded run-level options
 *   surfaced on `ctx`. Letting the child see `ctx.signal` matters for
 *   aborting in-flight child validation when the outer run is
 *   cancelled.
 * - `path: ctx.path` — used by the child's mounts to compute their
 *   own `ctx.path`, so a validator inside the child sees the
 *   absolute path it sits at (`['foo', 'street']`, not just
 *   `['street']`). Issue *paths* in the final thrown error don't
 *   depend on this forwarding — the outer Container's
 *   `prefixIssuePath` step rebuilds them from each level's own
 *   `keyParts` — but validators that inspect `ctx.path` (for
 *   logging, custom error formatting, etc.) would see a misleading
 *   relative path without it.
 * - `cache: ctx.cache` — the outer Container surfaces its run-level
 *   `IResultCache` on `ctx`, so threading it here keeps a
 *   container-as-branch participating in the same per-mount cache
 *   the outer container is using. Without this forward, mounts
 *   inside a compose-branch container would silently bypass the
 *   cache, breaking the cache contract for the
 *   `composeOneOf([…, childContainer])` shape.
 *
 * Other run-level options (`pathsToInclude`, `pathsToExclude`,
 * `defaults`, `parallel`) are intentionally NOT forwarded — they're
 * normally narrowed per-mount by the parent's run loop
 * (`resolvePathFilter`, `resolveDefaults`), and compose doesn't have
 * the parent mount key it would need to compute the equivalent
 * narrowing. A `composeOneOf` branch that's a container therefore
 * runs all of its mounts regardless of the outer's include/exclude
 * filter; if you need that level of inheritance, mount the container
 * directly with `container.mount(...)` instead of routing it through
 * compose.
 */
async function invokeComposeElement<C>(
    element: ComposeElement<C>,
    ctx: ValidatorContext<C>,
): Promise<unknown> {
    if (isContainer(element)) {
        return element.run(
            isObject(ctx.value) ? ctx.value : {},
            {
                path: ctx.path,
                group: ctx.group,
                context: ctx.context,
                signal: ctx.signal,
                cache: ctx.cache,
            },
        );
    }
    // `isContainer` narrows `element` to `IContainer`, but the
    // negative branch leaves it as the original union — TypeScript
    // doesn't subtract `IContainer` from a union containing
    // `Validator<C>` because their structural shapes overlap
    // (functions are objects). Cast to recover the call signature.
    return (element as Validator<C>)(ctx);
}

/**
 * Normalize one branch's failure into `Issue[]` ready to merge into
 * the outer `ONE_OF_FAILED` group. Each issue is tagged with
 * `params: { branch: index }` so a tree-walking consumer can report
 * "branch N failed because ..." without needing to reconstruct
 * registration order.
 *
 * Delegates the unknown-throw → `Issue[]` fold to the shared
 * `errorToIssues` cascade; only the per-branch stamping is local
 * concern. Spread issues are shallow-cloned before stamping so the
 * `ValidupError` instance's `issues` array on the caller side isn't
 * mutated when a consumer reads `.params.branch` later.
 */
function wrapBranchIssues(error: unknown, index: number): Issue[] {
    const stamp = <I extends Issue>(issue: I): I => {
        issue.params = { ...(issue.params ?? {}), branch: index };
        return issue;
    };
    return errorToIssues(error).map((issue) => stamp({ ...issue }));
}
