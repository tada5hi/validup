/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IResultCache } from '../cache';

export type ValidatorContext<C = unknown> = {
    /**
     * The expanded mount path in the current container.
     */
    key: string,

    /**
     * The global mount path of the parent container.
     */
    path: PropertyKey[],

    /**
     * The actual value, which should be validated.
     */
    value: unknown,

    /**
     * The input data of the current container.
     */
    data: Record<string, any>,

    /**
     * The group name for which the validator is executed.
     */
    group?: string,

    /**
     * Caller-supplied context, forwarded unchanged through nested containers.
     * Useful for request-scoped data (current user, locale, DB connection,
     * request id) that validators need but isn't part of the validated value.
     */
    context: C,

    /**
     * Cancellation signal forwarded from `ContainerRunOptions.signal`.
     * Async validators (DB lookups, HTTP fetches) should pass it through to
     * cancel I/O when the run is aborted. The container itself checks
     * `signal.aborted` between mounts and rethrows the signal's `reason`.
     */
    signal?: AbortSignal,

    /**
     * Result cache forwarded from `ContainerRunOptions.cache`. Surfaced so
     * orchestrating validators (notably `compose` with an `IContainer`
     * element) can pass the same cache instance into nested
     * `IContainer.run()` calls — without this thread-through, a
     * container-as-branch would silently bypass the cache and force every
     * mount inside it to re-run on every invocation.
     *
     * Bare validators almost never need to consult this — the Container
     * run loop already handles per-mount cache reads/writes around the
     * validator call. The field is on the public context for
     * composability, not for typical validator authoring.
     */
    cache?: IResultCache,
};

/**
 * A `Validator` either returns the (optionally transformed) value or throws.
 *
 * @typeParam C   - Caller-supplied context type, propagated from the parent
 *                  `Container<T, C>` and surfaced on `ValidatorContext.context`.
 * @typeParam Out - The validator's resolved output type. Defaults to `unknown`,
 *                  so call sites that don't care about typed output compile
 *                  unchanged. The builder API (`defineSchema`) uses this
 *                  second generic to accumulate per-field types.
 */
export type Validator<C = unknown, Out = unknown> = (ctx: ValidatorContext<C>) => Out | Promise<Out>;

/**
 * Authored descriptor for a validator — wraps the run function with metadata
 * the framework can act on (currently: `sideEffect`).
 *
 * Use the {@link defineValidator} factory rather than constructing the object
 * literally, so the descriptor shape stays consistent if more fields are
 * added later.
 *
 * Mounted via the same `mount(...)` signatures that accept a bare `Validator`
 * — the container normalises a bare function into `{ run: fn }` internally.
 * Side-effect-free descriptors participate in the per-mount result cache
 * (see `ContainerRunOptions.cache`); side-effecting ones never do.
 */
export type ValidatorDescriptor<C = unknown, Out = unknown> = {
    /**
     * `true` declares that the validator's output is NOT a pure function of
     * `(ctx.value, ctx.context, ctx.group)` — it may read sibling fields
     * from `ctx.data`, hit the network, observe global state, etc. The
     * framework will never cache its result; the validator runs on every
     * invocation, including per-keystroke runs.
     *
     * `false` (or omitted — the default) declares that the validator's
     * output is fully determined by `(value, context, group)`. When the
     * caller supplies a `ContainerRunOptions.cache`, the framework will
     * reuse the prior result whenever those three inputs match by identity
     * (Object.is for primitives, reference equality for objects).
     *
     * Default = cached. Mark cross-field / async / stateful validators
     * explicitly with `sideEffect: true`.
     */
    sideEffect?: boolean,

    /**
     * The validator function. Same shape as a bare-function mount.
     */
    run: Validator<C, Out>,
};
