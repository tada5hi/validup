/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { AttributeSource } from './constants';

export type Sources = {
    [p: string]: any
};

export type ValidatorErrorOptions = {
    children?: Record<string, any>[],
    code?: string | null
};

export type ValidatorExecuteOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    defaults?: {
        [K in keyof T]: any
    },
    group?: string,
    data?: Record<string, any>
};

export type ValidatorRegisterOptions = {
    src?: `${AttributeSource}`,
    group?: string | string[]
};

export type VChainRunContext = {
    key: string,
    value: unknown,
    src: Record<string, any>
};

export type VChain = {
    run: (ctx: VChainRunContext) => Promise<unknown> | unknown
};

export type VChainBox = {
    key: string,
    src?: `${AttributeSource}`,
    chain: VChain
};
