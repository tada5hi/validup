/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { AttributeSource } from './constants';

export type ValidatorRunOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    defaults?: {
        [K in keyof T]: any
    },
    group?: string,
    data?: Record<string, any>
};

export type ValidatorRunnerMountOptions = {
    src?: `${AttributeSource}`,
    group?: string | string[]
};

export type RunnerContext = {
    key: string,
    value: unknown,
    src: Record<string, any>
};
export type Runner = (ctx: RunnerContext) => Promise<unknown> | unknown;

export type RunnerConfig = {
    key: string,
    src?: `${AttributeSource}`,
    runner: Runner
};
