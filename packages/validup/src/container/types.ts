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
    ObjectLiteral, Validator,
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
     * default: false
     */
    optional?: boolean,

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

export interface IContainer<T extends ObjectLiteral = ObjectLiteral> {
    /**
     * Run container with given input.
     *
     * @param input
     * @param options
     */
    run(
        input?: Record<string, any>,
        options?: ContainerRunOptions<T>,
    ): Promise<T>

    /**
     * Safe run container with given input.
     *
     * @param input
     * @param options
     */
    safeRun(
        input?: Record<string, any>,
        options?: ContainerRunOptions<T>,
    ): Promise<Result<T>>
}

export type BaseMount = {
    options: MountOptions,
    path?: string,
};

export type ContainerMount = BaseMount & {
    type: 'container',
    data: IContainer,
};

export type ValidatorMount = BaseMount & {
    type: 'validator',
    data: Validator
};

export type Mount = ContainerMount | ValidatorMount;
