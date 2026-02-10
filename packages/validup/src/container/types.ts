/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Path } from 'pathtrace';
import type { OptionalValue } from '../constants';
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

export interface IContainer<T extends ObjectLiteral = ObjectLiteral> {
    /**
     * Execute container with given input.
     *
     * @param data
     * @param options
     */
    run(
        data?: Record<string, any>,
        options?: ContainerRunOptions<T>,
    ): Promise<T>
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
