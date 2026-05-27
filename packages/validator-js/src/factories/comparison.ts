/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { IssueCode } from 'validup';
import type { Validator } from 'validup';
import type { BaseFactoryOptions } from '../module';
import { throwValidupError, toValidatorString } from '../module';

/**
 * Factory: validator.js `matches`. Emits `IssueCode.PATTERN` on failure
 * with `params: { pattern: string }` (the regex source, no flags) so
 * i18n templates can quote it.
 */
export function matches<C = unknown>(pattern: RegExp | string, options: BaseFactoryOptions & {
    modifiers?: string,
} = {}): Validator<C> {
    const patternSource = typeof pattern === 'string' ? pattern : pattern.source;
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        const ok = typeof pattern === 'string' ?
            validator.matches(s, pattern, options.modifiers) :
            validator.matches(s, pattern);
        if (ok) return ctx.value;
        return throwValidupError(
            ctx.value,
            IssueCode.PATTERN,
            options.message ?? 'The value does not match the expected pattern',
            { pattern: patternSource },
        );
    };
}

/**
 * Factory: validator.js `equals`. Emits `IssueCode.SAME_AS` on failure
 * with `params: { other: string }` so a translated message can quote the
 * comparison subject (e.g. "must equal {{other}}").
 *
 * `comparison` is the field-name / label the i18n template should
 * surface — *not* the runtime value (which validator.js's `equals`
 * compares against). When the two are different, pass `expectedValue`
 * for the runtime comparison and `comparison` for the label.
 */
export function equals<C = unknown>(comparison: string, options: BaseFactoryOptions & {
    expectedValue?: string,
} = {}): Validator<C> {
    return (ctx) => {
        const s = toValidatorString(ctx.value);
        const target = options.expectedValue ?? comparison;
        if (validator.equals(s, target)) return ctx.value;
        return throwValidupError(
            ctx.value,
            IssueCode.SAME_AS,
            options.message ?? `The value must equal ${comparison}`,
            { other: comparison },
        );
    };
}
