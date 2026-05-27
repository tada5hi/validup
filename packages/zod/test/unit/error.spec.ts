/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import {
    Container,
    IssueCode,
    ValidupError,
    defineIssueItem,
    flattenIssueItems,
    isValidupError,
} from 'validup';
import { z } from 'zod';
import { buildIssuesForZodError, buildZodIssuesForError, createValidator } from '../../src';

describe('error', () => {
    it('should create zod issues', () => {
        const error = new ValidupError([
            defineIssueItem({
                message: 'The validation failed',
                path: ['foo'],
            }),
        ]);

        const zodIssues = buildZodIssuesForError(error);
        expect(zodIssues).toHaveLength(1);
    });

    it('should wrap error as zod issue', async () => {
        const childContainer = new Container();
        childContainer.mount('bar', createValidator(z.string()));

        const container = new Container<{ foo: string }>();
        container.mount('foo', createValidator(
            z
                .any()
                .check(async (ctx) => {
                    try {
                        await childContainer.run({ bar: ctx.value });
                    } catch (e) {
                        if (isValidupError(e)) {
                            ctx.issues.push(...buildZodIssuesForError(e));
                        }
                    }
                }),
        ));

        expect.assertions(2);

        const output = await container.safeRun({ foo: 1 });
        expect(output.success).toBeFalsy();
        if (!output.success) {
            expect(output.error).toBeInstanceOf(ValidupError);
        }
    });

    describe('vocabulary mapping (buildIssuesForZodError)', () => {
        // The mapping table is documented in src/error.ts. These tests assert
        // the dispatch — adapter consumers depend on `IssueItem.code` being
        // one of the vocabulary entries so i18n catalogs can translate it.

        it('maps a string min-length failure onto MIN_LENGTH with { min }', () => {
            const schema = z.string().min(5);
            const parsed = schema.safeParse('hi');
            if (parsed.success) throw new Error('expected zod parse to fail');

            const issues = buildIssuesForZodError(parsed.error);
            expect(issues).toHaveLength(1);
            const items = flattenIssueItems(issues);
            expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
            expect(items[0]?.params).toEqual({ min: 5 });
        });

        it('maps a string max-length failure onto MAX_LENGTH with { max }', () => {
            const schema = z.string().max(3);
            const parsed = schema.safeParse('toolong');
            if (parsed.success) throw new Error('expected zod parse to fail');

            const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
            expect(items[0]?.code).toBe(IssueCode.MAX_LENGTH);
            expect(items[0]?.params).toEqual({ max: 3 });
        });

        it('distinguishes number magnitude (MIN_VALUE) from string length', () => {
            const schema = z.number().min(10);
            const parsed = schema.safeParse(5);
            if (parsed.success) throw new Error('expected zod parse to fail');

            const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
            expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
            expect(items[0]?.params).toEqual({ min: 10 });
        });

        it('maps email/url/uuid/datetime onto vocabulary codes', () => {
            const cases: Array<[z.ZodTypeAny, unknown, string]> = [
                [z.string().email(), 'not-an-email', IssueCode.EMAIL],
                [z.string().url(), 'not a url', IssueCode.URL],
                [z.string().uuid(), 'not-a-uuid', IssueCode.NOT_UUID],
                [z.string().datetime(), 'not-a-datetime', IssueCode.INVALID_DATE],
            ];
            for (const [schema, value, expected] of cases) {
                const parsed = schema.safeParse(value);
                if (parsed.success) throw new Error(`expected zod parse to fail for ${value}`);
                const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
                expect(items[0]?.code, `case: ${expected}`).toBe(expected);
            }
        });

        it('maps a regex failure onto PATTERN_MISMATCH with { pattern }', () => {
            const schema = z.string().regex(/^[a-z]+$/, 'lowercase only');
            const parsed = schema.safeParse('UPPER');
            if (parsed.success) throw new Error('expected zod parse to fail');

            const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
            expect(items[0]?.code).toBe(IssueCode.PATTERN_MISMATCH);
            expect(items[0]?.params).toMatchObject({ pattern: expect.any(String) });
        });

        it('stays at VALUE_INVALID for missing keys (zod 4 limitation)', () => {
            // zod 4 collapses "missing key" and "wrong type" into the same
            // `invalid_type` issue without surfacing `received`, so we can't
            // structurally promote this to REQUIRED. The zod-supplied
            // English message still mentions "received undefined" for
            // consumers that need to render something.
            const schema = z.object({ email: z.string() });
            const parsed = schema.safeParse({});
            if (parsed.success) throw new Error('expected zod parse to fail');

            const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
            expect(items[0]?.message).toMatch(/undefined/i);
        });

        it('falls back to VALUE_INVALID for zod codes outside the vocabulary', () => {
            const schema = z.enum(['a', 'b']);
            const parsed = schema.safeParse('c');
            if (parsed.success) throw new Error('expected zod parse to fail');

            const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
            // Original zod message survives as the fallback display string.
            expect(items[0]?.message).toMatch(/Invalid|enum/i);
        });
    });
});
