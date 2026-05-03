/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Container } from '../container';
import type { IContainer, MountOptions } from '../container/types';
import type { Validator } from '../types';

/**
 * Cosmetic helper — flattens an intersection so editors render
 * `{ foo: string; bar: number }` instead of `{ foo: string } & { bar: number }`.
 */
export type Spread<T> = { [K in keyof T]: T[K] };

/**
 * Anything that can be mounted under a key on a `Builder`: a leaf validator,
 * a nested builder (auto-`.build()`-ed), or an existing `Container`.
 */
export type MountTarget<C> = Validator<C, any> |
    IBuilder<any, C> |
    IContainer<any, C>;

/**
 * `true` when `O` declares `optional: true` or `optional: (value) => …`. The
 * builder's `mount(key, options, target)` overload uses this to widen the
 * accumulated key to `{ K?: V }`. Plain `boolean`-typed options stay required —
 * the `const` modifier on the `mount` generic preserves literal `true` from
 * inline option objects, which is the common case.
 */
export type IsOptional<O> = O extends { optional: true } ? true :
    O extends { optional: (value: any) => any } ? true :
        false;

/**
 * Resolved field shape produced by `mount(key, target, …)`.
 *
 * Builder / Container targets → `{ [K]: U }` where `U` is the child's shape.
 * Validator targets → `{ [K]: Awaited<Out> }` based on the validator's return
 * type. In all three cases, `IsOptional<O>` widens the property to
 * `{ [K]?: … }` when `options.optional` is the literal `true` or a predicate —
 * matching the runtime behavior that an optional mount may be skipped, leaving
 * the key absent from the output.
 */
export type Mounted<K extends string, V, O> = V extends IBuilder<infer U, any> ?
    IsOptional<O> extends true ? { [P in K]?: U } : { [P in K]: U } :
    V extends IContainer<infer U, any> ?
        IsOptional<O> extends true ? { [P in K]?: U } : { [P in K]: U } :
        V extends Validator<any, infer Out> ?
            IsOptional<O> extends true ?
                { [P in K]?: Awaited<Out> } :
                { [P in K]: Awaited<Out> } :
            never;

/**
 * Compile-time-typed schema builder. `mount(...)` accumulates the resolved
 * field type into `T`, so `build()` returns a `Container<T, C>` whose static
 * return type from `run()` reflects exactly what was registered.
 *
 * Builders are immutable: every method returns a new `Builder` so chains
 * may fork without leaking state. The shape of `mount` mirrors
 * `Container.mount`'s keyed forms — `(key, target)` and
 * `(key, options, target)` — so transferring patterns between the imperative
 * and builder APIs is straightforward.
 */
export interface IBuilder<T extends Record<string, any>, C = unknown> {
    /**
     * Mount a leaf validator, nested builder, or existing container at `key`.
     * The accumulated shape gains the resolved type of `target`. Re-mounting
     * the same key overrides the previous registration's type (matching the
     * runtime "last write wins" behavior of `Container.mount`).
     */
    mount<K extends string, V extends MountTarget<C>>(
        key: K,
        target: V,
    ): IBuilder<Spread<Omit<T, K> & Mounted<K, V, undefined>>, C>;

    /**
     * Mount with `MountOptions`. When `options.optional` is `true` (or a
     * predicate function) the accumulated key widens to `{ K?: V }`.
     */
    mount<
        K extends string,
        const O extends MountOptions,
        V extends MountTarget<C>,
    >(
        key: K,
        options: O,
        target: V,
    ): IBuilder<Spread<Omit<T, K> & Mounted<K, V, O>>, C>;

    /** Mark the resulting container as `oneOf` (only one branch must succeed). */
    oneOf(): IBuilder<T, C>;

    /** Restrict the resulting container's `pathsToInclude`. */
    pathsToInclude(...paths: (keyof T & string)[]): IBuilder<T, C>;

    /** Restrict the resulting container's `pathsToExclude`. */
    pathsToExclude(...paths: (keyof T & string)[]): IBuilder<T, C>;

    /** Materialize a `Container<T, C>` and replay every accumulated mount. */
    build(): Container<T, C>;
}
