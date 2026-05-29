/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    IssueCode,
    createValidupError,
    defineValidator,
} from 'validup';
import type { ValidatorDescriptor } from 'validup';

/**
 * Shape of a validator.js boolean predicate. The first argument is always
 * the string to test; subsequent arguments are validator-specific options.
 */
export type ValidatorJsFn = (value: string, ...args: any[]) => boolean;

/**
 * Options accepted by every factory (and {@link createValidator}). The
 * factory layers vocabulary-specific fields on top of this shape.
 */
export interface BaseFactoryOptions {
    /**
     * Override the default English message produced by the factory. The
     * default tracks `@ilingo/validup`'s `en` catalog so the same wording
     * surfaces with and without i18n.
     */
    message?: string;
}

/**
 * Options accepted by {@link createValidator}. The vocabulary code is
 * required — that's the entire point of the generic wrap; if you just
 * want `VALUE_INVALID`, hand-roll a `Validator` instead.
 */
export interface CreateValidatorOptions extends BaseFactoryOptions {
    /**
     * `IssueCode` value (or any project-specific string) attached to the
     * `IssueItem` on failure.
     */
    code: string;
    /**
     * Optional structured payload surfaced on `IssueItem.params` — what
     * the i18n template's `{{placeholders}}` resolve against.
     */
    params?: Record<string, unknown>;
}

/**
 * Build a string representation suitable for validator.js. validator.js
 * functions expect strings; for numbers and booleans we use `String(...)`
 * so consumers can mount `isInt()` on a `number`-shaped field without
 * pre-stringifying.
 */
export function toValidatorString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value === null || value === undefined) return '';
    return String(value);
}

/**
 * Generic wrap for any validator.js function we don't ship a pre-baked
 * factory for. The wrapped validator stringifies `ctx.value`, calls the
 * validator.js predicate, and throws a `ValidupError` carrying the
 * supplied `code` (+ optional `params`) on failure.
 *
 * @example
 *     import validator from 'validator';
 *     import { createValidator } from '@validup/validator-js';
 *
 *     container.mount('card', createValidator(validator.isCreditCard, {
 *         code: 'credit_card',
 *         message: 'Invalid credit card number',
 *     }));
 *
 * For the common cases — `email()`, `isLength()`, `isInt()` etc. — reach
 * for the pre-baked factories instead; they bake the right vocabulary
 * code and `params` in for you.
 *
 * The returned descriptor participates in the validup result cache by
 * default — validator.js's `ValidatorJsFn` signature is synchronous
 * and only inspects the stringified value, so the outcome is a pure
 * function of `(ctx.value, ctx.context, ctx.group)`. If the wrapped
 * predicate captures external state and the caller knowingly opts
 * into that, pass `sideEffect: true` to bypass the cache.
 */
export function createValidator<C = unknown>(
    fn: ValidatorJsFn,
    options: CreateValidatorOptions & { sideEffect?: boolean },
): ValidatorDescriptor<C> {
    const fallbackCode = options.code || IssueCode.VALUE_INVALID;
    const fallbackMessage = options.message ?? 'The value is invalid';

    return defineValidator<C>({
        sideEffect: options.sideEffect,
        run: (ctx) => {
            const stringified = toValidatorString(ctx.value);
            if (fn(stringified)) {
                return ctx.value;
            }
            throw createValidupError(ctx.value, fallbackCode, fallbackMessage, options.params);
        },
    });
}
