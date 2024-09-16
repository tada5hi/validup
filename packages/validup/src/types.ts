/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { OptionalValue } from './constants';
import type { Container } from './module';

export type ObjectLiteral = Record<string | number, any>;

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
    pathsToInclude?: ObjectPropertyPath<T>[]
};

export type ContainerRunOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    /**
     * Default values for the container output.
     */
    defaults?: {
        [Key in ObjectPropertyPath<T>]: any
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
    path?: string,
    /**
     * Limit mounted paths on execution.
     * By default, all mounted containers/validators will
     * be considered for execution.
     */
    pathsToInclude?: ObjectPropertyPath<T>[]
};

export type ValidatorContext = {
    /**
     * The expanded mount path in the current container.
     */
    path: string,
    /**
     * The unexpanded mount path in the current container.
     */
    pathRaw: string,
    /**
     * The global mount path of the parent container.
     */
    pathAbsolute: string,
    /**
     * The actual value, which should be validated.
     */
    value: unknown,
    /**
     * The input data of the current container.
     */
    data: Record<string, any>
};
export type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;

export type ContainerMountOptions = {
    /**
     * Group(s) to execute.
     */
    group?: string | string[],

    /**
     * Limit mounted paths on execution.
     * By default, all mounted containers/validators will
     * be considered for execution.
     */
    pathsToInclude?: string[],

    /**
     * Specify if the mounted container has to be evaluated successfully.
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
    optionalInclude?: boolean
};

export type ContainerItem = ContainerMountOptions & {
    path?: string,
    data: Validator | Container
};

type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

type PrevIndex = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export type ObjectPropertyPathExtended<T, Depth extends number = 4> = [Depth] extends [0] ? never : T extends ObjectLiteral ?
    {
        [Key in keyof T & (string | number)]: T[Key] extends unknown[] ?
            (ObjectPropertyPathExtended<ArrayElement<T[Key]>, PrevIndex[Depth]> extends string ?
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                `${Key}[${number}].${ObjectPropertyPathExtended<ArrayElement<T[Key]>, PrevIndex[Depth]>}` |
                `${Key}.*.${ObjectPropertyPathExtended<ArrayElement<T[Key]>, PrevIndex[Depth]>}` |
                `${Key}` :
                `${Key}[${number}]` | `${Key}`
            ) :
            T[Key] extends ObjectLiteral ?
                (
                    ObjectPropertyPathExtended<T[Key], PrevIndex[Depth]> extends string ?
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        `${Key}.${ObjectPropertyPathExtended<T[Key], PrevIndex[Depth]>}` |
                        `*.${ObjectPropertyPathExtended<T[Key], PrevIndex[Depth]>}` |
                        `${Key}` :
                        `${Key}`
                ) :
                `${Key}`
    }[keyof T & (string | number)] :
    never;

export type ObjectPropertyPath<T, Depth extends number = 4> = [Depth] extends [0] ? never : T extends ObjectLiteral ?
    {
        [Key in keyof T & (string | number)]: T[Key] extends unknown[] ?
            (ObjectPropertyPath<ArrayElement<T[Key]>, PrevIndex[Depth]> extends string ?
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            `${Key}[${number}].${ObjectPropertyPath<ArrayElement<T[Key]>, PrevIndex[Depth]>}` |
            `${Key}` :
            `${Key}[${number}]` | `${Key}`
            ) :
            T[Key] extends ObjectLiteral ?
                (
                    ObjectPropertyPath<T[Key], PrevIndex[Depth]> extends string ?
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    `${Key}.${ObjectPropertyPath<T[Key], PrevIndex[Depth]>}` |
                    `${Key}` :
                    `${Key}`
                ) :
            `${Key}`
    }[keyof T & (string | number)] :
    never;
