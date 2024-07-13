/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ValidatorRunOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    defaults?: {
        [K in keyof T]: any
    },
    group?: string,
    data?: Record<string, any>
};

export type AttributeValidatorContext = {
    key: string,
    value: unknown,
    src: Record<string, any>
};
export type AttributeValidator = (ctx: AttributeValidatorContext) => Promise<unknown> | unknown;

export type AttributeValidatorConfig = {
    key: string,
    group?: string | string[],
    src?: string,
    validator: AttributeValidator
};
