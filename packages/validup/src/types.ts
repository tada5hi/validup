/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Container } from './module';

export type ContainerRunOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    defaults?: {
        [Key in ObjectPropertyPath<T>]: any
    },
    group?: string,
    flat?: boolean,
    path?: string,
    pathRaw?: string
};

export type ValidatorContext = {
    key: string,
    path: string,
    pathRaw: string,
    value: unknown,
    data: Record<string, any>
};
export type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;

export type ContainerMountOptions = {
    group?: string | string[]
};

export type ContainerItem = ContainerMountOptions & {
    path: string,
    data: Validator | Container
};

type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

type ObjectLiteral = Record<string | number, any>;

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
                    ObjectPropertyPathExtended<T[Key]> extends string ?
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
            (ObjectPropertyPathExtended<ArrayElement<T[Key]>, PrevIndex[Depth]> extends string ?
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            `${Key}[${number}].${ObjectPropertyPathExtended<ArrayElement<T[Key]>, PrevIndex[Depth]>}` |
            `${Key}` :
            `${Key}[${number}]` | `${Key}`
            ) :
            T[Key] extends ObjectLiteral ?
                (
                    ObjectPropertyPathExtended<T[Key]> extends string ?
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    `${Key}.${ObjectPropertyPathExtended<T[Key], PrevIndex[Depth]>}` |
                    `${Key}` :
                    `${Key}`
                ) :
            `${Key}`
    }[keyof T & (string | number)] :
    never;
