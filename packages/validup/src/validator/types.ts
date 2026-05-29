/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Validator } from '../types';

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
