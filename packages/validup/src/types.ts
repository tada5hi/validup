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
        [K in keyof T]: any
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
