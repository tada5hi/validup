/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ObjectLiteral = Record<string | number, any>;

export type ValidatorContext = {
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
    group?: string
};

export type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;
