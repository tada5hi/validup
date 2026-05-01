/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Container, ValidupError } from 'validup';
import { buildIssuesForStandardSchemaIssues, createValidator } from '../../src';

describe('@validup/standard-schema', () => {
    it('should validate via a Standard Schema (zod 4)', async () => {
        const validator = new Container<{ email: string }>();
        validator.mount('email', createValidator(z.string().email()));

        const outcome = await validator.run({ email: 'foo@example.com' });

        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should accept a factory that builds the schema from context', async () => {
        const validator = new Container<{ email: string }>();
        validator.mount('email', createValidator((ctx) => {
            // Schema can depend on validator context (group/data/context).
            expect(ctx.key).toEqual('email');
            return z.string().email();
        }));

        const outcome = await validator.run({ email: 'foo@example.com' });
        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should translate Standard Schema issues into validup IssueItems', async () => {
        const validator = new Container<{ email: string }>();
        validator.mount('email', createValidator(z.string().email()));

        expect.assertions(3);
        try {
            await validator.run({ email: 'not-an-email' });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0]?.path).toEqual(['email']);
                expect(e.issues[0]?.message).toEqual('Invalid email address');
            }
        }
    });

    it('should normalize PathSegment objects in nested schemas', async () => {
        const validator = new Container<{ foo: unknown }>();
        validator.mount(
            'foo',
            createValidator(z.object({ bar: z.string().array().min(2) })),
        );

        expect.assertions(3);
        try {
            await validator.run({ foo: { bar: [0] } });
        } catch (e) {
            if (e instanceof ValidupError) {
                // Multiple schema-side issues collapse into an IssueGroup at
                // the mount path; the inner issues carry the merged paths.
                const [group] = e.issues;
                if (group?.type === 'group') {
                    const innerPaths = group.issues.map((i) => i.path);
                    expect(innerPaths).toContainEqual(['foo', 'bar', 0]);
                    expect(innerPaths).toContainEqual(['foo', 'bar']);
                    expect(group.issues.every((i) => i.type === 'item')).toBe(true);
                }
            }
        }
    });

    it('should accept a synthetic Standard Schema (vendor-agnostic)', async () => {
        // Hand-rolled schema to verify the adapter doesn't depend on zod internals.
        const greaterThan10 = {
            '~standard': {
                version: 1 as const,
                vendor: 'test',
                validate(value: unknown) {
                    if (typeof value === 'number' && value > 10) {
                        return { value };
                    }
                    return {
                        issues: [
                            {
                                // Path is relative to the validated value;
                                // validup prepends the mount key.
                                message: 'must be greater than 10',
                            },
                        ],
                    };
                },
            },
        };

        const validator = new Container<{ amount: number }>();
        validator.mount('amount', createValidator(greaterThan10));

        const ok = await validator.run({ amount: 42 });
        expect(ok.amount).toEqual(42);

        expect.assertions(3);
        try {
            await validator.run({ amount: 5 });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues[0]?.message).toEqual('must be greater than 10');
                expect(e.issues[0]?.path).toEqual(['amount']);
            }
        }
    });

    it('should normalize PathSegment objects ({ key }) when present', () => {
        // Some Standard Schema vendors (notably valibot) emit `{ key }`
        // wrappers in path. Verify normalizePath unwraps them.
        const out = buildIssuesForStandardSchemaIssues([
            { message: 'invalid', path: [{ key: 'foo' }, { key: 0 }, 'bar'] },
        ]);
        expect(out[0]?.path).toEqual(['foo', 0, 'bar']);
    });
});
