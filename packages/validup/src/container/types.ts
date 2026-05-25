/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Path } from 'pathtrace';
import type { OptionalValue } from '../constants';
import type { ValidupError } from '../error';
import type {
    ObjectLiteral, 
    Validator,
} from '../types';

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
    pathsToExclude?: Path<T>[]
};

export type ContainerRunOptions<
    T extends Record<string, any> = Record<string, any>,
    C = unknown,
> = {
    /**
     * Default values for the container output.
     */
    defaults?: {
        [Key in Path<T>]: any
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
     * Which values are considered optional.
     * An optional value won't be passed to the underlying container/validator.
     *
     * default: 'undefined'
     */
    optionalValue?: `${OptionalValue}`,

    /**
     * Include optional value as property in output.
     *
     * default: false
     */
    optionalInclude?: boolean,
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

export interface IContainer<T extends ObjectLiteral = ObjectLiteral, C = unknown> {
    /**
     * Run the container against `input`. Throws `ValidupError` on validation
     * failure; rethrows `signal.reason` when the run is aborted via
     * `options.signal`.
     */
    run(
        input?: Record<string, any>,
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
        input?: Record<string, any>,
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
        input?: Record<string, any>,
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
        input?: Record<string, any>,
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
    data: Validator<C>
};

export type Mount<C = unknown> = ContainerMount | ValidatorMount<C>;
