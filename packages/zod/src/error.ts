/*
 * Copyright (c) 2024-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    IssueCode,
    defineIssueItem,
    hasOwnProperty,
    isIssueItem,
} from 'validup';
import { getPathValue } from 'pathtrace';
import type { $ZodIssue, $ZodRawIssue } from 'zod/v4/core';
import type { ZodError } from 'zod';
import type { Issue, ValidupError } from 'validup';

export type ZodIssue = $ZodRawIssue;

/**
 * Names of zod 4 `too_small` / `too_big` issue `origin` values that
 * measure a sequence length (string, array, etc.) rather than a numeric
 * magnitude. Used to pick between validup's `MIN_LENGTH` / `MAX_LENGTH`
 * (length-shaped) and `MIN_VALUE` / `MAX_VALUE` (magnitude-shaped) codes.
 */
const LENGTH_LIKE_ORIGINS = new Set(['string', 'array', 'set', 'file']);

/**
 * Internal — picks a validup `IssueCode` for a zod issue and (when the
 * code calls for it) builds the structured `data` payload templates
 * rely on (`{{min}}`, `{{max}}`, `{{pattern}}`, …).
 *
 * Falls back to `VALUE_INVALID` for zod codes that don't have a clear
 * vocabulary match — the original zod `message` carries through on the
 * resulting validup `IssueItem.message` so consumer-side rendering still
 * has something to display.
 */
function mapZodIssue(
    raw: ZodIssue | $ZodIssue,
    input: unknown,
    inputProvided: boolean,
): {
    code: string,
    data?: Record<string, unknown>,
} {
    switch (raw.code) {
        case 'invalid_type': {
            // zod 4 strips `input` / `received` from the formatted issue
            // (only `expected` is populated), so structurally we can't tell
            // missing-key from wrong-type from the issue alone. When the
            // caller threads the original parsed input through, we can
            // recover REQUIRED by looking up the leaf value at the issue
            // path — if it's `undefined`, the field was absent (or
            // explicitly `undefined`), which is the REQUIRED case.
            // Wrong-type stays on VALUE_INVALID; the zod-supplied English
            // message still surfaces as the fallback display string in
            // both branches.
            if (inputProvided) {
                const path = raw.path ?? [];
                const leaf = path.length === 0 ?
                    input :
                    getPathValue(input, path as PropertyKey[]);
                if (typeof leaf === 'undefined') {
                    return { code: IssueCode.REQUIRED };
                }
            }
            return { code: IssueCode.VALUE_INVALID };
        }
        case 'too_small': {
            const origin = String(raw.origin ?? '');
            const min = Number(raw.minimum);
            if (LENGTH_LIKE_ORIGINS.has(origin)) {
                return { code: IssueCode.MIN_LENGTH, data: { min } };
            }
            return { code: IssueCode.MIN_VALUE, data: { min } };
        }
        case 'too_big': {
            const origin = String(raw.origin ?? '');
            const max = Number(raw.maximum);
            if (LENGTH_LIKE_ORIGINS.has(origin)) {
                return { code: IssueCode.MAX_LENGTH, data: { max } };
            }
            return { code: IssueCode.MAX_VALUE, data: { max } };
        }
        case 'invalid_format': {
            const format = String(raw.format ?? '');
            switch (format) {
                case 'email':
                    return { code: IssueCode.EMAIL };
                case 'url':
                    return { code: IssueCode.URL };
                case 'uuid':
                case 'guid':
                    return { code: IssueCode.UUID };
                // nanoid / cuid / cuid2 / ulid are distinct ID formats — an
                // i18n template keyed on `UUID` would render "must be a valid
                // UUID" against a nanoid field, which is wrong. Fall back to
                // the generic code so consumers can add catalog entries for
                // these formats explicitly if they care.
                case 'nanoid':
                case 'cuid':
                case 'cuid2':
                case 'ulid':
                    return { code: IssueCode.VALUE_INVALID };
                case 'date':
                case 'time':
                case 'datetime':
                case 'duration':
                    return { code: IssueCode.DATE };
                case 'ipv4':
                case 'ipv6':
                case 'cidrv4':
                case 'cidrv6':
                    return { code: IssueCode.IP_ADDRESS };
                case 'base64':
                case 'base64url':
                    return { code: IssueCode.BASE64 };
                case 'json_string':
                    return { code: IssueCode.JSON };
                case 'regex': {
                    const pattern = typeof raw.pattern === 'string' ?
                        raw.pattern :
                        String(raw.pattern ?? '');
                    return { code: IssueCode.PATTERN, data: { pattern } };
                }
                default:
                    return { code: IssueCode.VALUE_INVALID };
            }
        }
        case 'invalid_value':
            // zod 4 emits `invalid_value` for both enum (`z.enum([...])`)
            // and literal (`z.literal(...)`) mismatches — the value didn't
            // match any of a closed set of options. That's the same shape
            // as a failed `oneOf` container, so reuse the existing
            // vocabulary entry.
            return { code: IssueCode.ONE_OF_FAILED };
        // The remaining zod codes don't have a clean vocabulary match —
        // `invalid_union`, `invalid_key`, `invalid_element`,
        // `unrecognized_keys`, `not_multiple_of`, `custom`. Fall back to
        // the generic code; the zod-supplied `message` still surfaces
        // verbatim on the IssueItem.
        default:
            return { code: IssueCode.VALUE_INVALID };
    }
}

/**
 * Translate a `ZodError` into validup `Issue`s. Each zod issue gets:
 *
 * - `code` — mapped onto the validup `IssueCode` vocabulary where
 *   possible (see {@link mapZodIssue} for the table); falls back to
 *   `IssueCode.VALUE_INVALID` for zod codes that don't have a vocabulary
 *   equivalent.
 * - `message` — zod's own message, verbatim. Consumer-side i18n
 *   catalogs override this via the `code` lookup; `message` is the
 *   English fallback when no translation is registered.
 * - `data` — structured payload for code-aware templates
 *   (`{{min}}` / `{{max}}` / `{{pattern}}`); absent when the code
 *   carries no parameters.
 * - `expected` / `received` — vendor-specific zod fields, passed
 *   through when present.
 *
 * Pass the original parsed input as the second argument to enable the
 * `invalid_type` → `REQUIRED` promotion: zod 4's formatted issues don't
 * carry `received`, so we recover the missing-key signal by looking up
 * the issue's path against the input and checking whether the leaf is
 * `undefined`. {@link createValidator} threads `ctx.value` through
 * automatically; ad-hoc callers can opt in by passing it explicitly.
 */
export function buildIssuesForZodError(error: ZodError, input?: unknown): Issue[] {
    const issues : Issue[] = [];
    const inputProvided = arguments.length > 1;

    for (let i = 0; i < error.issues.length; i++) {
        const issue = error.issues[i];

        const { code, data } = mapZodIssue(issue, input, inputProvided);

        let expected : unknown;
        if (hasOwnProperty(issue, 'expected')) {
            expected = issue.expected;
        }

        let received : unknown;
        if (hasOwnProperty(issue, 'received')) {
            received = issue.received;
        }

        issues.push(defineIssueItem({
            path: issue.path || [],
            message: issue.message,
            code,
            data,
            expected,
            received,
        }));
    }

    return issues;
}

/**
 * Build Zod Issues for validup issue.
 *
 * @param issue
 */
export function buildZodIssuesForIssue(issue: Issue) : ZodIssue[] {
    if (isIssueItem(issue)) {
        return [
            {
                code: 'custom',
                message: issue.message,
                path: issue.path,
                input: issue.received,
            },
        ];
    }

    const output : ZodIssue[] = [];
    for (let i = 0; i < issue.issues.length; i++) {
        const child = issue.issues[i];

        output.push(...buildZodIssuesForIssue(child));
    }

    return output;
}

export function buildZodIssuesForError(error: ValidupError) : ZodIssue[] {
    return error.issues
        .flatMap((issue) => buildZodIssuesForIssue(issue));
}
