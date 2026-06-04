/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Path } from 'pathtrace';
import type { IResultCache } from '../cache';
import type { OptionalValue } from '../constants';
import type { ValidupError } from '../error';
import type {
    ObjectLiteral,
} from '../types';
import type { Validator } from '../validator';

export type ContainerOptions<T> = {
    /**
     * Only one of the mounted container/validators must succeed.
     */
    oneOf?: boolean,

    /**
     * Limit mounted paths on execution.
     * By default, all mounted containers/validators will
     * be considered for execution.
     */
    pathsToInclude?: Path<T>[],

    /**
     * Exclude mounted paths on execution.
     * By default, all mounted containers/validators will
     * be considered for execution.
     */
    pathsToExclude?: Path<T>[],

    /**
     * Container-wide default for `MountOptions.optionalValue`. Applied
     * to mounts in this container that declare `optional: true` (or a
     * truthy predicate) without setting their own `optionalValue`.
     *
     * Precedence (highest → lowest): `MountOptions` → `ContainerRunOptions`
     * → `ContainerOptions` → core default (`'undefined'`).
     */
    optionalValue?: `${OptionalValue}` | readonly `${OptionalValue}`[],

    /**
     * Container-wide default for `MountOptions.optionalAs`. Applied to
     * mounts in this container that qualify as optional without setting
     * their own `optionalAs`. Presence (not value) activates the
     * directive — `{ optionalAs: undefined }` means "emit `undefined`",
     * which differs from omitting the option.
     *
     * Precedence (highest → lowest): `MountOptions` → `ContainerRunOptions`
     * → `ContainerOptions`.
     */
    optionalAs?: unknown,
};

export type ContainerRunOptions<
    T extends Record<string, any> = Record<string, any>,
    C = unknown,
> = {
    /**
     * Default values for the container output. Each key is optional — supply
     * only the paths you want to backfill. When the validated output is missing
     * a key (or holds `undefined`), the matching entry from `defaults` is used.
     */
    defaults?: {
        [Key in Path<T>]?: any
    },
    /**
     * Group to execute.
     */
    group?: string,

    /**
     * Output flat object?
     */
    flat?: boolean,

    /**
     * Passed path from the parent container.
     */
    path?: PropertyKey[],

    /**
     * Limit mounted paths on execution.
     * By default, all mounted containers/validators will
     * be considered for execution.
     */
    pathsToInclude?: Path<T>[]

    /**
     * Exclude mounted paths on execution.
     * By default, all mounted containers/validators will
     * be considered for execution.
     */
    pathsToExclude?: Path<T>[]

    /**
     * Caller-supplied context surfaced on `ValidatorContext.context`. Forwarded
     * unchanged into nested container `run()` calls so the entire tree shares
     * the same value.
     */
    context?: C,

    /**
     * Cancellation signal. The container checks `signal.aborted` between
     * mounts and rethrows `signal.reason` when set. Forwarded unchanged into
     * nested `run()` calls and surfaced on `ValidatorContext.signal` so async
     * validators can pass it into `fetch`, DB drivers, etc.
     */
    signal?: AbortSignal,

    /**
     * Run mounted validators / nested containers concurrently rather than
     * sequentially. Useful when several independent fields hit slow async
     * resources (DB lookups, HTTP calls). Forwarded unchanged into nested
     * `run()` calls.
     *
     * **Trade-off — chained-key reads are not supported in parallel mode.**
     * Sequential `run()` reads each mount's `value` from `output[key]` when
     * an earlier sibling mount already wrote there (so a sanitizer at
     * `email` followed by a validator at `email` sees the sanitized output).
     * Parallel mode reads `value` from the input `data` for every mount
     * because siblings may not have completed yet. If you rely on chained
     * sanitize-then-validate patterns, stay on sequential mode (the
     * default). The behavior is intentional and consistent between
     * `run({parallel: true})` and `safeRun({parallel: true})` — there is
     * no diagnostic when a chained pattern is used in parallel mode; the
     * later mount silently observes the un-sanitized input.
     */
    parallel?: boolean

    /**
     * Per-mount result cache. When supplied, validator mounts that have
     * NOT declared `sideEffect: true` (via `defineValidator`) will be
     * skipped whenever the cached snapshot `(ctx.value, ctx.context,
     * ctx.group)` matches the current invocation — replaying the prior
     * issues and output without re-running the validator.
     *
     * Forwarded unchanged into nested `run()` calls so the same cache
     * threads through the whole container tree (a nested container's
     * own pure validators participate too).
     *
     * Omitting `cache` disables the optimization entirely; every mount
     * runs every time, regardless of any `sideEffect` declaration.
     */
    cache?: IResultCache,

    /**
     * Run-level fallback for `MountOptions.optionalValue`. When a mount
     * declares `optional: true` but does NOT set its own `optionalValue`,
     * this value decides what counts as "absent". Per-mount setting
     * wins; this is only the fallback.
     *
     * Predicate-form `optional: (value) => boolean` does not consult
     * `optionalValue` at all — the predicate decides directly.
     *
     * Forwarded into nested container `run()` calls so the entire
     * sub-tree shares the same default unless a child mount overrides.
     *
     * Hosts that know their idiom set this once — e.g. an app using
     * `@validup/vue` can `app.use(createValidup({ optionalValue:
     * ['undefined', 'empty_string'] }))` to make untouched `<input>`
     * fields (`v-model` holds `''`) count as missing across every form.
     * Server / CLI callers typically leave it unset and let the
     * conservative core default (`'undefined'`) apply.
     *
     * Precedence (highest → lowest): `MountOptions` → `ContainerRunOptions`
     * → `ContainerOptions` → core default.
     */
    optionalValue?: `${OptionalValue}` | readonly `${OptionalValue}`[],

    /**
     * Run-level fallback for `MountOptions.optionalAs`. When a mount
     * qualifies as optional without setting its own `optionalAs`, this
     * value is written to the output. Presence (not value) activates
     * the directive — `{ optionalAs: undefined }` is meaningful
     * ("emit `undefined`") and differs from omitting the option.
     *
     * Forwarded into nested container `run()` calls.
     *
     * Precedence (highest → lowest): `MountOptions` → `ContainerRunOptions`
     * → `ContainerOptions`.
     */
    optionalAs?: unknown,
};

export type MountOptions = {
    /**
     * Group(s) to execute.
     */
    group?: string | string[],

    /**
     * Specify if an optional value is also acceptable for the mount key.
     * An optional value won't be passed to the underlying container/validator.
     *
     * Pass a predicate `(value) => boolean` for fine-grained control beyond
     * what `optionalValue` covers (e.g. "treat empty string as missing but
     * keep `0`"). When a predicate is provided, `optionalValue` is ignored.
     *
     * default: false
     */
    optional?: boolean | ((value: unknown) => boolean),

    /**
     * Which values are considered optional. Pass a single atom
     * (`'undefined'` / `'null'` / `'empty_string'` / `'zero'` / `'false'`
     * / `'nan'`) for a one-value match, the composite shortcut `'falsy'`
     * for any JS falsy value, or an array of atoms to compose a custom
     * set (e.g. `['undefined', 'null', 'empty_string']` for the common
     * "missing or blank" intent).
     *
     * Atoms match exactly one runtime value — `'null'` does NOT also
     * include `undefined`. Pass `['null', 'undefined']` explicitly when
     * both should qualify.
     *
     * default: 'undefined'
     */
    optionalValue?: `${OptionalValue}` | readonly `${OptionalValue}`[],

    /**
     * Include optional value as property in output.
     *
     * default: false
     */
    optionalInclude?: boolean,

    /**
     * Canonical value written to the output when the mount qualifies
     * as optional. Useful for normalizing multiple "missing" sentinels
     * (`undefined` / `null` / `''`) into a single shape the consumer
     * expects (e.g. always `null` when posting to a backend).
     *
     * When set, the runtime ignores `optionalInclude` and writes
     * `optionalAs` regardless of the input value. Property presence
     * matters (not "is undefined"): `{ optionalAs: undefined }` is a
     * meaningful directive ("emit `undefined` for this key") and
     * differs from omitting the option entirely.
     *
     * @example
     * container.mount('description', {
     *     optional: true,
     *     optionalValue: ['undefined', 'null', 'empty_string'],
     *     optionalAs: null,
     * }, isString);
     *
     * await container.run({ description: '' });       // → { description: null }
     * await container.run({ description: undefined }); // → { description: null }
     * await container.run({ description: null });     // → { description: null }
     */
    optionalAs?: unknown,
};

export type ResultSuccess<T> = {
    success: true;
    data: T,
    error?: never
};

export type ResultFailure = {
    success: false;
    data?: never,
    error: ValidupError;
};

export type Result<T extends ObjectLiteral = ObjectLiteral> = ResultSuccess<T> | ResultFailure;

/**
 * Input shape accepted by `IContainer.run` (and siblings). Typed as
 * `Partial<T>` so callers can hand in form objects that are narrower than the
 * validator's full entity type (the typical "create/edit form for a server
 * entity" case — fields like `id` / `createdAt` are server-set and not part
 * of the form). The runtime treats unmounted keys as pass-through, so the
 * type just reflects what the validator actually inspects.
 *
 * **Extra keys.** A variable-typed object with extra keys not in `T` is
 * accepted via TS's structural object-type rules (no excess-property check
 * outside of fresh literals). An object **literal** with extra keys does
 * trigger TS's excess-property check against `Partial<T>` — pre-fix
 * `Record<string, any>` accepted such literals silently; if a call site
 * relies on that, cast the literal or assign it to a variable first.
 */
export type ContainerInput<T extends ObjectLiteral = ObjectLiteral> = Partial<T>;

export interface IContainer<T extends ObjectLiteral = ObjectLiteral, C = unknown> {
    /**
     * Run the container against `input`. Throws `ValidupError` on validation
     * failure; rethrows `signal.reason` when the run is aborted via
     * `options.signal`.
     */
    run(
        input?: ContainerInput<T>,
        options?: ContainerRunOptions<T, C>,
    ): Promise<T>

    /**
     * Run the container against `input` and return a discriminated `Result`
     * instead of throwing on validation failure.
     *
     * **Contract — when `safeRun` can still throw:**
     * - The run is aborted via `options.signal` — `signal.reason` is
     *   re-thrown verbatim so callers can distinguish "validation failed"
     *   from "operation cancelled."
     * - This is the **only** sanctioned reason. Implementations that throw
     *   for any other reason violate the contract; consumers that wrap
     *   `safeRun` in a defensive `try/catch` (e.g. `@validup/vue`) treat
     *   such throws as a synthetic path-less failure.
     */
    safeRun(
        input?: ContainerInput<T>,
        options?: ContainerRunOptions<T, C>,
    ): Promise<Result<T>>

    /**
     * Synchronous variant of `run()`. Optional — implementations can omit
     * this when their validators are inherently async. The default
     * `Container` provides it; nested containers without it cannot be
     * traversed by a parent's `runSync`.
     *
     * Throws `RunSyncViolationError` (structural — distinct from validation
     * failures) when any validator returns a thenable or any nested
     * container lacks `runSync`. Those throws bypass the issue-folding path
     * and surface verbatim.
     */
    runSync?(
        input?: ContainerInput<T>,
        options?: ContainerRunOptions<T, C>,
    ): T

    /**
     * Synchronous variant of `safeRun()`. Optional — same caveat as `runSync`.
     *
     * Same throw-contract as `safeRun`, plus: `RunSyncViolationError`s are
     * re-thrown (not wrapped into `Result.failure`) because they signal a
     * structural mismatch, not a validation outcome.
     */
    safeRunSync?(
        input?: ContainerInput<T>,
        options?: ContainerRunOptions<T, C>,
    ): Result<T>
}

export type BaseMount = {
    options: MountOptions,
    /**
     * Mount path expressed in dot/bracket notation (e.g. `foo.bar`,
     * `items[0].name`). Path segments are joined and split on `.` throughout
     * the runtime, so keys that contain a *literal* dot (e.g. an object keyed
     * `data['user.email']`) are not addressable as a single mount segment and
     * will produce ambiguous flat output when merged. Use bracketed/array
     * shapes instead for inputs that contain literal-dot keys.
     */
    path?: string,
};

export type ContainerMount = BaseMount & {
    type: 'container',
    // Child containers carry their own context type; the parent's context
    // value is forwarded unchanged at run time. We don't constrain the child's
    // C parameter here — variance through the discriminated union is awkward
    // and the practical contract is "whatever the parent has, pass it through".
    data: IContainer<any, any>,
};

export type ValidatorMount<C = unknown> = BaseMount & {
    type: 'validator',
    data: Validator<C>,
    /**
     * Resolved at mount time from a `ValidatorDescriptor.sideEffect`
     * declaration. `true` means the framework will never cache this
     * mount's result; `false` / `undefined` means the result is
     * cache-eligible when the caller supplies
     * `ContainerRunOptions.cache`.
     *
     * Bare-function mounts always land here as `undefined` — the
     * bare-function shape has no place to declare side effects, so
     * the framework defaults them to cache-eligible (the same
     * default as a `defineValidator` call without `sideEffect`).
     * Wrap with `defineValidator({ sideEffect: true, run: fn })` to
     * opt out.
     */
    sideEffect?: boolean,
};

export type Mount<C = unknown> = ContainerMount | ValidatorMount<C>;
