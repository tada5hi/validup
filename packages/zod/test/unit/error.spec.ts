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
        // One test per zod → validup mapping. The mapping table is the
        // contract adapters expose; if a row drifts, the matching test
        // here surfaces it immediately rather than relying on i18n consumers
        // to notice "wait, my catalog entry never fires."
        //
        // Helper to keep each test compact.
        const parseAndMap = (schema: z.ZodTypeAny, value: unknown) => {
            const parsed = schema.safeParse(value);
            if (parsed.success) throw new Error('expected zod parse to fail');
            return flattenIssueItems(buildIssuesForZodError(parsed.error));
        };

        // ── too_small / too_big — length axis vs. magnitude axis ───────────
        it('too_small (string) → MIN_LENGTH', () => {
            const items = parseAndMap(z.string().min(5), 'hi');
            expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
            expect(items[0]?.data).toEqual({ min: 5 });
        });
        it('too_big (string) → MAX_LENGTH', () => {
            const items = parseAndMap(z.string().max(3), 'toolong');
            expect(items[0]?.code).toBe(IssueCode.MAX_LENGTH);
            expect(items[0]?.data).toEqual({ max: 3 });
        });
        it('too_small (array) → MIN_LENGTH', () => {
            const items = parseAndMap(z.array(z.number()).min(2), [1]);
            expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
            expect(items[0]?.data).toEqual({ min: 2 });
        });
        it('too_big (array) → MAX_LENGTH', () => {
            const items = parseAndMap(z.array(z.number()).max(2), [1, 2, 3]);
            expect(items[0]?.code).toBe(IssueCode.MAX_LENGTH);
            expect(items[0]?.data).toEqual({ max: 2 });
        });
        it('too_small (number) → MIN_VALUE', () => {
            const items = parseAndMap(z.number().min(10), 5);
            expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
            expect(items[0]?.data).toEqual({ min: 10 });
        });
        it('too_big (number) → MAX_VALUE', () => {
            const items = parseAndMap(z.number().max(10), 50);
            expect(items[0]?.code).toBe(IssueCode.MAX_VALUE);
            expect(items[0]?.data).toEqual({ max: 10 });
        });

        // ── invalid_format — one test per zod format ─────────────────────
        it('invalid_format email → EMAIL', () => {
            const items = parseAndMap(z.email(), 'not-an-email');
            expect(items[0]?.code).toBe(IssueCode.EMAIL);
        });
        it('invalid_format url → URL', () => {
            const items = parseAndMap(z.url(), 'not a url');
            expect(items[0]?.code).toBe(IssueCode.URL);
        });
        it('invalid_format uuid → UUID', () => {
            const items = parseAndMap(z.uuid(), 'not-a-uuid');
            expect(items[0]?.code).toBe(IssueCode.UUID);
        });
        it('invalid_format nanoid → VALUE_INVALID (not UUID — distinct format)', () => {
            // nanoid / cuid / ulid produce different shapes than UUIDs and
            // shouldn't conflate with the UUID translation key. The mapper
            // intentionally falls back to VALUE_INVALID so consumers add
            // their own code if they care.
            const items = parseAndMap(z.nanoid(), 'short');
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
        });
        it('invalid_format datetime → DATE', () => {
            const items = parseAndMap(z.iso.datetime(), 'not-a-datetime');
            expect(items[0]?.code).toBe(IssueCode.DATE);
        });
        it('invalid_format ipv4 → IP_ADDRESS', () => {
            const items = parseAndMap(z.ipv4(), 'not-an-ip');
            expect(items[0]?.code).toBe(IssueCode.IP_ADDRESS);
        });
        it('invalid_format ipv6 → IP_ADDRESS', () => {
            const items = parseAndMap(z.ipv6(), 'not-an-ip');
            expect(items[0]?.code).toBe(IssueCode.IP_ADDRESS);
        });
        it('invalid_format base64 → BASE64', () => {
            const items = parseAndMap(z.base64(), 'not base64!');
            expect(items[0]?.code).toBe(IssueCode.BASE64);
        });
        it('invalid_format regex → PATTERN with { pattern }', () => {
            const items = parseAndMap(z.string().regex(/^[a-z]+$/), 'UPPER');
            expect(items[0]?.code).toBe(IssueCode.PATTERN);
            expect(items[0]?.data).toMatchObject({ pattern: expect.any(String) });
        });
        it('invalid_format with an unmapped format → VALUE_INVALID', () => {
            // Pick a string format that's not in the mapping table — emoji
            // checks are an example of vendor-specific shapes we don't carry.
            const schema = z.string().refine(() => false, { data: { format: 'emoji' } });
            const items = parseAndMap(schema, 'plain');
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
        });

        // ── invalid_type (incl. zod-4 missing-key collapse) ──────────────
        it('invalid_type (wrong type) → VALUE_INVALID', () => {
            const items = parseAndMap(z.string(), 42);
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
        });
        it('invalid_type (missing key, zod-4 limitation) → VALUE_INVALID', () => {
            // zod 4 collapses "missing key" and "wrong type" into the same
            // `invalid_type` issue without surfacing `received`, so we can't
            // structurally promote this to REQUIRED. The zod-supplied
            // English message still mentions "received undefined" for
            // consumers that need to render something.
            const items = parseAndMap(z.object({ email: z.string() }), {});
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
            expect(items[0]?.message).toMatch(/undefined/i);
        });

        // ── fallback for codes outside the vocabulary ─────────────────────
        it('invalid_value (enum) → VALUE_INVALID', () => {
            const items = parseAndMap(z.enum(['a', 'b']), 'c');
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
            // Original zod message survives as the fallback display string.
            expect(items[0]?.message).toMatch(/Invalid|enum/i);
        });
    });
});
