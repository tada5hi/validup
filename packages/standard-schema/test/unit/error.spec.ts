/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { IssueCode, flattenIssueItems } from 'validup';
import { z } from 'zod';
import { buildIssuesForStandardSchemaIssues } from '../../src';

describe('buildIssuesForStandardSchemaIssues', () => {
    it('should translate real Standard Schema issues (zod 4) into IssueItems', async () => {
        // Drive the adapter off a genuine `~standard.validate` result
        // rather than a hand-built fixture, so the assumed shape of the
        // spec payload is checked against an actual implementation.
        const schema = z.object({ profile: z.object({ tags: z.array(z.string()).min(2) }) });
        const result = await schema['~standard'].validate({ profile: { tags: [1] } });

        expect(result.issues).toBeDefined();
        const issues = buildIssuesForStandardSchemaIssues(result.issues!);

        // One IssueItem per Standard Schema issue, in order. Paths carry
        // through as PropertyKey[] with numeric array indices preserved as
        // numbers (not stringified).
        expect(issues).toHaveLength(2);
        expect(issues.map((issue) => issue.path)).toEqual([
            ['profile', 'tags', 0],
            ['profile', 'tags'],
        ]);
        expect(issues.every((issue) => issue.type === 'item')).toBe(true);
    });

    it('should carry the spec-portable subset only (message + path + default code)', async () => {
        // Standard Schema exposes `message` and `path` and nothing else —
        // vendor fields like zod's `expected` / `received` / `code` are
        // deliberately dropped, so every issue lands on the generic code.
        const result = await z.email()['~standard'].validate('not-an-email');

        expect(result.issues).toBeDefined();
        const [issue] = flattenIssueItems(buildIssuesForStandardSchemaIssues(result.issues!));

        expect(issue?.message).toEqual('Invalid email address');
        expect(issue?.code).toEqual(IssueCode.VALUE_INVALID);
        expect(issue?.data).toBeUndefined();
        expect(issue?.expected).toBeUndefined();
        expect(issue?.received).toBeUndefined();
    });

    describe('normalizePath', () => {
        it('should return an empty path for an empty segment list', () => {
            // A root-level failure (`z.email()` mounted directly on a
            // scalar) reports `path: []`. The early return must yield a
            // fresh `[]` so the container prepends only its mount key.
            const [issue] = buildIssuesForStandardSchemaIssues([
                { message: 'invalid', path: [] },
            ]);

            expect(issue?.path).toEqual([]);
        });

        it('should return an empty path when path is absent', () => {
            // `path` is optional in the spec — vendors are free to omit it
            // entirely for whole-value failures.
            const [issue] = buildIssuesForStandardSchemaIssues([
                { message: 'invalid' },
            ]);

            expect(issue?.path).toEqual([]);
        });

        it('should unwrap { key }-shaped PathSegments', () => {
            // valibot (and other vendors) emit object segments carrying the
            // key plus vendor metadata; only `.key` is portable.
            const [issue] = buildIssuesForStandardSchemaIssues([
                {
                    message: 'invalid',
                    path: [
                        { key: 'profile' },
                        { key: 'tags' },
                        { key: 0 },
                    ],
                },
            ]);

            expect(issue?.path).toEqual(['profile', 'tags', 0]);
        });

        it('should pass raw PropertyKey segments through untouched', () => {
            const marker = Symbol('marker');
            const [issue] = buildIssuesForStandardSchemaIssues([
                { message: 'invalid', path: ['profile', 1, marker] },
            ]);

            expect(issue?.path).toEqual(['profile', 1, marker]);
        });

        it('should normalize mixed raw and { key }-shaped segments', () => {
            // The two branches alternate within a single path — the loop
            // decides per segment, not per issue.
            const [issue] = buildIssuesForStandardSchemaIssues([
                {
                    message: 'invalid',
                    path: ['profile', { key: 'tags' }, 0, { key: 'name' }],
                },
            ]);

            expect(issue?.path).toEqual(['profile', 'tags', 0, 'name']);
        });
    });

    it('should return an empty list for an empty issue list', () => {
        expect(buildIssuesForStandardSchemaIssues([])).toEqual([]);
    });
});
