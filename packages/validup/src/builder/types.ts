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
 * Compile-time-typed schema builder. Each terminal method (`field`,
 * `optional`, `nest`) accumulates the resolved field type into `T`, so
 * `build()` returns a `Container<T, C>` whose static return type from
 * `run()` reflects exactly what was registered.
 *
 * Builders are immutable: every method returns a new `Builder` so chains
 * may fork without leaking state.
 */
export interface Builder<T extends Record<string, any>, C = unknown> {
    /**
     * Mount a leaf validator at `key`. The accumulated shape gains
     * `{ [K]: Awaited<Out> }`. Pass a typed validator (e.g. one returned by
     * `@validup/zod`'s `createValidator`) to flow real types through; bare
     * `Validator<C>` validators contribute `unknown`.
     */
    field<K extends string, Out>(
        key: K,
        validator: Validator<C, Out>,
        options?: MountOptions,
    ): Builder<Spread<T & { [P in K]: Awaited<Out> }>, C>;

    /**
     * Mount an optional leaf validator at `key`. The accumulated shape gains
     * `{ [K]?: Awaited<Out> }`. The `optional` mount option is set
     * automatically; use `optionalValue` / `optionalInclude` via the third
     * parameter if needed.
     */
    optional<K extends string, Out>(
        key: K,
        validator: Validator<C, Out>,
        options?: Omit<MountOptions, 'optional'>,
    ): Builder<Spread<T & { [P in K]?: Awaited<Out> }>, C>;

    /**
     * Mount a nested builder/container at `key`. The accumulated shape gains
     * `{ [K]: U }` where `U` is the child's resolved shape. Builders are
     * `.build()`-ed automatically; passing a `Container<U, C>` works too.
     */
    nest<K extends string, U extends Record<string, any>>(
        key: K,
        child: Builder<U, C> | IContainer<U, C>,
        options?: MountOptions,
    ): Builder<Spread<T & { [P in K]: U }>, C>;

    /** Mark the resulting container as `oneOf` (only one branch must succeed). */
    oneOf(): Builder<T, C>;

    /** Restrict the resulting container's `pathsToInclude`. */
    pathsToInclude(...paths: (keyof T & string)[]): Builder<T, C>;

    /** Restrict the resulting container's `pathsToExclude`. */
    pathsToExclude(...paths: (keyof T & string)[]): Builder<T, C>;

    /** Materialize a `Container<T, C>` and replay every accumulated mount. */
    build(): Container<T, C>;
}
