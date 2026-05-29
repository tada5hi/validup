/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { getPathValue } from 'pathtrace';
import validator from 'validator';
import { IssueCode, createValidupError, defineValidator } from 'validup';
import type { ValidatorDescriptor } from 'validup';
import type { BaseFactoryOptions } from '../module';
import { toValidatorString } from '../module';

/**
 * Factory: validator.js `matches`. Emits `IssueCode.PATTERN` on failure
 * with `params: { pattern: string }` (the regex source, no flags) so
 * i18n templates can quote it.
 */
export function matches<C = unknown>(pattern: RegExp | string, options: BaseFactoryOptions & {
    modifiers?: string,
} = {}): ValidatorDescriptor<C> {
    const patternSource = typeof pattern === 'string' ? pattern : pattern.source;
    return defineValidator<C>({
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            const ok = typeof pattern === 'string' ?
                validator.matches(s, pattern, options.modifiers) :
                validator.matches(s, pattern);
            if (ok) return ctx.value;
            throw createValidupError(
                ctx.value,
                IssueCode.PATTERN,
                options.message ?? 'The value does not match the expected pattern',
                { pattern: patternSource },
            );
        },
    });
}

/**
 * Factory: validator.js `equals`. Emits `IssueCode.SAME_AS` on failure
 * with `params: { other: string }` so a translated message can quote the
 * key subject (e.g. "must equal {{other}}").
 *
 * `key` is the field-name / label the i18n template should
 * surface. When `expectedValue` is omitted, `key` is also used as a
 * pathtrace path into `ctx.data` to look up the runtime comparison
 * target — so `equals('password')` mounted on `passwordConfirm`
 * compares against `ctx.data.password`. Pass `expectedValue`
 * explicitly to compare against a fixed string instead.
 *
 * **Side-effect contract.** When `expectedValue` is provided the
 * validator is a pure function of `ctx.value` and participates in the
 * result cache like every other factory. When `expectedValue` is
 * omitted the validator reads `ctx.data[key]` — a sibling field —
 * which the cache's `(value, context, group)` snapshot does NOT
 * capture. The factory therefore stamps `sideEffect: true` in that
 * branch so the framework re-runs it on every invocation; otherwise a
 * `passwordConfirm` check would stay stale after `password` changes.
 */
export function equals<C = unknown>(key: string, options: BaseFactoryOptions & {
    expectedValue?: string,
} = {}): ValidatorDescriptor<C> {
    return defineValidator<C>({
        sideEffect: typeof options.expectedValue === 'undefined',
        run: (ctx) => {
            const s = toValidatorString(ctx.value);
            const target = options.expectedValue ?? toValidatorString(getPathValue(ctx.data, key));
            if (validator.equals(s, target)) return ctx.value;
            throw createValidupError(
                ctx.value,
                IssueCode.SAME_AS,
                options.message ?? `The value must equal ${key}`,
                { other: key },
            );
        },
    });
}
