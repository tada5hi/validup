/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ContainerRunOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    defaults?: {
        [K in keyof T]: any
    },
    group?: string,
    keysFlat?: boolean
};

export type ValidatorContext = {
    key: string,
    keyRaw: string,
    value: unknown,
    data: Record<string, any>
};
export type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;

export type ValidatorConfig = {
    key: string,
    group?: string | string[],
    src?: string,
    validator: Validator
};
