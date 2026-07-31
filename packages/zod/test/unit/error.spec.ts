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
    defineIssueGroup,
    defineIssueItem,
    flattenIssueItems,
    isValidupError,
} from 'validup';
import { z } from 'zod';
import {
    buildIssuesForZodError,
    buildZodIssuesForError,
    buildZodIssuesForIssue,
    createValidator,
} from '../../src';

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
        // Helper to keep each test compact. Threads the parsed input
        // through so the `invalid_type` → REQUIRED promotion (which
        // depends on a missing-key lookup against the input) is exercised
        // by the same code path the runtime uses via `createValidator`.
        const parseAndMap = (schema: z.ZodTypeAny, value: unknown) => {
            const parsed = schema.safeParse(value);
            if (parsed.success) throw new Error('expected zod parse to fail');
            return flattenIssueItems(buildIssuesForZodError(parsed.error, value));
        };

        const isJsonString = (value: string) => {
            try {
                JSON.parse(value);
                return true;
            } catch {
                return false;
            }
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
        it('too_small (set) → MIN_LENGTH', () => {
            // `set` is one of the four LENGTH_LIKE_ORIGINS; dropping it
            // would silently re-route Set size failures onto the numeric
            // MIN_VALUE template ("must be at least 2" vs. "must have at
            // least 2 items").
            const items = parseAndMap(z.set(z.string()).min(2), new Set(['a']));
            expect(items[0]?.code).toBe(IssueCode.MIN_LENGTH);
            expect(items[0]?.data).toEqual({ min: 2 });
        });
        it('too_small (date) → MIN_VALUE', () => {
            // `date` is deliberately NOT length-like — a date bound is a
            // magnitude. zod reports the bound as an epoch millisecond
            // number, which is what lands in `data.min`.
            const min = new Date('2030-01-01T00:00:00.000Z');
            const items = parseAndMap(z.date().min(min), new Date('2020-01-01T00:00:00.000Z'));
            expect(items[0]?.code).toBe(IssueCode.MIN_VALUE);
            expect(items[0]?.data).toEqual({ min: min.getTime() });
        });

        // ── invalid_format — one row per zod format label ────────────────
        //
        // Table-driven on purpose. Several format labels share a single
        // `return` in the switch (`cuid` / `cuid2` / `ulid` fall through
        // to one `VALUE_INVALID`, `date` / `time` / `datetime` /
        // `duration` to one `DATE`, …), and v8 coverage cannot tell a
        // fall-through label apart from its consequent. So moving `cuid`
        // up into the `UUID` group — exactly the mistake the comment in
        // `mapZodIssue` warns against — stays 100 % coverage-green.
        // Only a per-label assertion catches it.
        //
        // `data` is asserted alongside `code` because the pair is the
        // contract consumer i18n catalogs (e.g. `@ilingo/validup`) key on:
        // the code selects the template, `data` fills its placeholders.
        // Bare codes must carry no `data` at all.
        type FormatCase = [
            label: string,
            schema: z.ZodTypeAny,
            value: unknown,
            code: string,
            data?: Record<string, unknown>,
        ];

        const formatCases: FormatCase[] = [
            ['email', z.email(), 'not-an-email', IssueCode.EMAIL],
            ['url', z.url(), 'not a url', IssueCode.URL],
            ['uuid', z.uuid(), 'not-a-uuid', IssueCode.UUID],
            ['guid', z.guid(), 'not-a-guid', IssueCode.UUID],
            // nanoid / cuid / cuid2 / ulid produce different shapes than
            // UUIDs and must not conflate with the UUID translation key —
            // "must be a valid UUID" against a nanoid field is wrong. The
            // mapper falls back to the generic code so consumers can add
            // their own catalog entry per format.
            ['nanoid', z.nanoid(), 'short', IssueCode.VALUE_INVALID],
            ['cuid', z.cuid(), 'nope', IssueCode.VALUE_INVALID],
            ['cuid2', z.cuid2(), '!!!', IssueCode.VALUE_INVALID],
            ['ulid', z.ulid(), 'nope', IssueCode.VALUE_INVALID],
            ['datetime', z.iso.datetime(), 'not-a-datetime', IssueCode.DATE],
            ['date', z.iso.date(), 'not-a-date', IssueCode.DATE],
            ['time', z.iso.time(), 'not-a-time', IssueCode.DATE],
            ['duration', z.iso.duration(), 'not-a-duration', IssueCode.DATE],
            ['ipv4', z.ipv4(), 'not-an-ip', IssueCode.IP_ADDRESS],
            ['ipv6', z.ipv6(), 'not-an-ip', IssueCode.IP_ADDRESS],
            ['cidrv4', z.cidrv4(), 'not-a-cidr', IssueCode.IP_ADDRESS],
            ['cidrv6', z.cidrv6(), 'not-a-cidr', IssueCode.IP_ADDRESS],
            ['base64', z.base64(), 'not base64!', IssueCode.BASE64],
            ['base64url', z.base64url(), 'not base64url!', IssueCode.BASE64],
            // No zod 4 constructor emits `json_string` on its own, but the
            // format label is part of `$ZodStringFormats` and ships in every
            // locale catalog — `z.stringFormat` registers a real string
            // check under that label.
            ['json_string', z.stringFormat('json_string', isJsonString), '{not json', IssueCode.JSON],
            ['regex', z.string().regex(/^[a-z]+$/), 'UPPER', IssueCode.PATTERN, { pattern: expect.any(String) }],
            // Genuinely unmapped format — reaches the `default` arm of the
            // inner `invalid_format` switch. `z.emoji()` really emits
            // `code: 'invalid_format', format: 'emoji'`; a `.refine()`
            // carrying a `format` in its `data` does NOT (it emits
            // `code: 'custom'` and never enters this switch at all).
            ['emoji (unmapped)', z.emoji(), 'plain', IssueCode.VALUE_INVALID],
        ];

        it.each(formatCases)('invalid_format $0 → $3', (label, schema, value, code, data) => {
            const items = parseAndMap(schema, value);
            expect(items).toHaveLength(1);
            expect(items[0]?.code).toBe(code);
            if (data) {
                expect(items[0]?.data).toMatchObject(data);
            } else {
                expect(items[0]?.data).toBeUndefined();
            }
        });

        // ── invalid_type (incl. zod-4 missing-key collapse) ──────────────
        it('invalid_type (wrong type) → VALUE_INVALID', () => {
            const items = parseAndMap(z.string(), 42);
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
        });
        it('invalid_type (missing key) → REQUIRED', () => {
            // zod 4 collapses "missing key" and "wrong type" into the same
            // `invalid_type` issue and strips `input` from the formatted
            // ZodError. We recover the REQUIRED signal by looking the
            // issue path up against the original parsed input — when the
            // leaf is `undefined`, the field was absent.
            const items = parseAndMap(z.object({ email: z.string() }), {});
            expect(items[0]?.code).toBe(IssueCode.REQUIRED);
        });
        it('invalid_type → falls back to VALUE_INVALID when input not threaded', () => {
            // Without the second argument we can't run the missing-key
            // probe, so the mapper stays on the safe VALUE_INVALID
            // fallback. Preserves the contract of the single-arg overload
            // for callers that hold a ZodError but not the input.
            const parsed = z.object({ email: z.string() }).safeParse({});
            if (parsed.success) throw new Error('expected zod parse to fail');
            const items = flattenIssueItems(buildIssuesForZodError(parsed.error));
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
        });

        // ── invalid_value — enum / literal mismatches ────────────────────
        it('invalid_value (enum) → ONE_OF_FAILED', () => {
            const items = parseAndMap(z.enum(['a', 'b']), 'c');
            expect(items[0]?.code).toBe(IssueCode.ONE_OF_FAILED);
            // Original zod message survives as the fallback display string.
            expect(items[0]?.message).toMatch(/Invalid|expected/i);
        });
        it('invalid_value (literal) → ONE_OF_FAILED', () => {
            const items = parseAndMap(z.literal('foo'), 'bar');
            expect(items[0]?.code).toBe(IssueCode.ONE_OF_FAILED);
        });

        // ── top-level default — zod codes with no vocabulary match ───────
        //
        // These four share the single `default` at the bottom of
        // `mapZodIssue`'s outer switch. Adding a dedicated mapping for any
        // one of them (say `not_multiple_of` → a new MULTIPLE_OF code)
        // must show up here as a red row, not as a silent behaviour change
        // for consumers keyed on VALUE_INVALID.
        const defaultCases: [label: string, schema: z.ZodTypeAny, value: unknown][] = [
            ['invalid_union', z.union([z.string(), z.number()]), true],
            ['not_multiple_of', z.number().multipleOf(3), 5],
            ['unrecognized_keys', z.strictObject({ a: z.string() }), { a: 'x', b: 1 }],
            ['custom', z.string().refine(() => false), 'x'],
        ];

        it.each(defaultCases)('$0 → VALUE_INVALID (no vocabulary match)', (label, schema, value) => {
            const items = parseAndMap(schema, value);
            expect(items).toHaveLength(1);
            expect(items[0]?.code).toBe(IssueCode.VALUE_INVALID);
            expect(items[0]?.data).toBeUndefined();
            // zod's own English message is the display fallback when no
            // catalog entry exists for the generic code.
            expect(items[0]?.message).toEqual(expect.any(String));
            expect(items[0]?.message.length).toBeGreaterThan(0);
        });
    });

    describe('validup → zod (buildZodIssuesForIssue)', () => {
        it('recurses into IssueGroups and emits one zod issue per leaf item', () => {
            const error = new ValidupError([
                defineIssueGroup({
                    path: ['user'],
                    message: 'user is invalid',
                    issues: [
                        defineIssueItem({
                            path: ['user', 'name'],
                            message: 'name is required',
                            received: 'x',
                        }),
                        defineIssueGroup({
                            path: ['user', 'address'],
                            message: 'address is invalid',
                            issues: [
                                defineIssueItem({
                                    path: ['user', 'address', 'city'],
                                    message: 'city is required',
                                }),
                            ],
                        }),
                    ],
                }),
            ]);

            const zodIssues = buildZodIssuesForError(error);

            // The group wrappers themselves are NOT emitted — zod has no
            // group shape, so only leaves cross the boundary. Nesting depth
            // is flattened, and pre-order is preserved.
            expect(zodIssues).toEqual([
                {
                    code: 'custom',
                    message: 'name is required',
                    path: ['user', 'name'],
                    input: 'x',
                },
                {
                    code: 'custom',
                    message: 'city is required',
                    path: ['user', 'address', 'city'],
                    input: undefined,
                },
            ]);
        });

        it('emits nothing for a group with no issues', () => {
            const output = buildZodIssuesForIssue(defineIssueGroup({
                path: ['user'],
                message: 'user is invalid',
                issues: [],
            }));

            expect(output).toEqual([]);
        });

        it('group-derived issues are accepted by a real zod check', () => {
            // End-to-end proof the recursion emits a shape zod itself will
            // ingest — the reverse direction exists so validup issues can
            // be pushed into `ctx.issues` from inside a zod schema.
            const error = new ValidupError([
                defineIssueGroup({
                    path: ['user'],
                    message: 'user is invalid',
                    issues: [
                        defineIssueItem({ path: ['user', 'name'], message: 'name is required' }),
                        defineIssueItem({ path: ['user', 'email'], message: 'email is required' }),
                    ],
                }),
            ]);

            const schema = z.any().check((ctx) => {
                ctx.issues.push(...buildZodIssuesForError(error));
            });

            const outcome = schema.safeParse('anything');

            expect(outcome.success).toBe(false);
            if (!outcome.success) {
                expect(outcome.error.issues.map((issue) => issue.path)).toEqual([
                    ['user', 'name'],
                    ['user', 'email'],
                ]);
                expect(outcome.error.issues.map((issue) => issue.message)).toEqual([
                    'name is required',
                    'email is required',
                ]);
            }
        });
    });
});
