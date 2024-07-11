/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ValidationChain as BaseValidationChain,
    ContextRunner,
    CustomSanitizer,
    CustomValidationChain,
    CustomValidator,
    ExpressValidator,
} from 'express-validator';
import type { Middleware, Request } from 'express-validator/lib/base';
import type { AttributeSource } from './constants';

export type Sources = Request;

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
    group?: string
};

export type ValidatorRegisterOptions = {
    src?: `${AttributeSource}`,
    group?: string | string[]
};

export type ValidationChain = BaseValidationChain;
export type ValidationOneOf = Middleware & ContextRunner;

type ChainCreateFn<C> = (
    attribute: string,
    source?: `${AttributeSource}`,
) => C;

type OneOfCreateFn<C> = (
    chains: C[]
) => ValidationOneOf;

export type Factory<
    VALIDATORS extends Record<string, CustomValidator> = Record<string, CustomValidator>,
    SANITIZERS extends Record<string, CustomSanitizer> = Record<string, CustomSanitizer>,
> = {
    createChain: ChainCreateFn<CustomValidationChain<ExpressValidator<VALIDATORS, SANITIZERS>>>,
    createOneOf: OneOfCreateFn<CustomValidationChain<ExpressValidator<VALIDATORS, SANITIZERS>>>
};
