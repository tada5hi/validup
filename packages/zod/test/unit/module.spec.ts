/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { IssueCode, flattenIssueItems } from '@ebec/core';
import {
    Container,
    ResultCache,
    ValidupError,
} from 'validup';
import { createValidator } from '../../src';

describe('src/module', () => {
    it('should validate', async () => {
        const validator = new Container<{ email: string }>();

        validator.mount('email', createValidator(z.string().email()));

        const outcome = await validator.run({ email: 'foo@example.com' });

        expect(outcome).toBeDefined();
        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should validate with validator fn', async () => {
        const validator = new Container<{ email: string }>();

        validator.mount('email', createValidator(() => z.string().email()));

        const outcome = await validator.run({ email: 'foo@example.com' });

        expect(outcome).toBeDefined();
        expect(outcome.email).toEqual('foo@example.com');
    });

    it('should not validate', async () => {
        const validator = new Container<{ email: string }>();

        validator.mount('email', createValidator(z.string().email()));

        expect.assertions(3);

        try {
            await validator.run({ email: 'foo' });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].message).toEqual('Invalid email address');
                expect(e.issues[0].path).toEqual(['email']);
            }
        }
    });

    it('should not validate nested container', async () => {
        const child = new Container<{ email: string }>();

        child.mount('email', createValidator(z.string().email()));

        const parent = new Container<{ child: { email: string } }>();

        parent.mount('child', child);

        expect.assertions(3);

        try {
            await parent.run({ child: { email: 'foo' } });
        } catch (e) {
            if (e instanceof ValidupError) {
                const [issue] = e.issues;

                expect(issue.path).toEqual(['child']);

                if (issue.type === 'group') {
                    expect(issue.issues).toHaveLength(1);
                    expect(issue.issues[0].path).toEqual(['child', 'email']);
                }
            }
        }
    });

    it('should not validate nested container with empty child mount path', async () => {
        const child = new Container<{ email: string }>();

        child.mount('email', createValidator(z.string().email()));

        const parent = new Container<{ child: { email: string } }>();

        parent.mount(child);

        expect.assertions(2);

        try {
            await parent.run({ child: { email: 'foo' } });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].path).toEqual(['email']);
            }
        }
    });

    it('createValidator participates in the result cache by default', async () => {
        const container = new Container<{ email: string }>();
        let calls = 0;

        container.mount('email', createValidator(() => {
            calls += 1;

            return z.string().email();
        }));

        const cache = new ResultCache();
        const data = { email: 'foo@example.com' };

        await container.run(data, { cache });
        await container.run(data, { cache });
        expect(calls).toBe(1);
    });

    it('createValidator({ sideEffect: true }) bypasses the cache', async () => {
        const container = new Container<{ email: string }>();
        let calls = 0;

        container.mount('email', createValidator(
            () => {
                calls += 1;

                return z.string().email();
            },
            { sideEffect: true },
        ));

        const cache = new ResultCache();
        const data = { email: 'foo@example.com' };

        await container.run(data, { cache });
        await container.run(data, { cache });
        expect(calls).toBe(2);
    });

    it('createValidator threads input so missing keys map to REQUIRED', async () => {
        // End-to-end check: the runtime path through createValidator must
        // pass ctx.value to buildIssuesForZodError so the invalid_type →
        // REQUIRED promotion fires for missing-key cases. Without the
        // thread, every missing field would collapse back to VALUE_INVALID
        // (the historical bug described in #397).
        const validator = new Container<{ user: { email: string } }>();

        validator.mount('user', createValidator(z.object({
            email: z.string(),
            name: z.string(),
        })));

        expect.assertions(2);

        try {
            await validator.run({ user: { email: 'present' } });
        } catch (e) {
            if (e instanceof ValidupError) {
                const items = flattenIssueItems(e.issues);
                const missing = items.find((it) => it.path.join('.') === 'user.name');

                expect(missing).toBeDefined();
                expect(missing?.code).toBe(IssueCode.REQUIRED);
            }
        }
    });

    it('should not validate array', async () => {
        const validator = new Container<{ foo: unknown[] }>();

        validator.mount('foo', createValidator(z.object({ bar: z.string().array().min(2) })));

        expect.assertions(5);

        try {
            await validator.run({ foo: { bar: [0] } });
        } catch (e) {
            if (e instanceof ValidupError) {
                const [group] = e.issues;

                if (group.type === 'group') {
                    expect(group.issues.length).toEqual(2);

                    expect(group.issues[0].message).toEqual('Invalid input: expected string, received number');
                    expect(group.issues[0].path).toEqual(['foo', 'bar', 0]);

                    expect(group.issues[1].message).toEqual('Too small: expected array to have >=2 items');
                    expect(group.issues[1].path).toEqual(['foo', 'bar']);
                }
            }
        }
    });

    describe('run mode', () => {
        const buildContext = (value: unknown, sync?: boolean) => ({
            key: 'name',
            path: ['name'],
            value,
            data: { name: value },
            context: undefined,
            sync,
        });

        it('should run a sync schema under runSync', () => {
            const validator = new Container<{ email: string }>();

            validator.mount('email', createValidator(z.string().email()));

            const outcome = validator.runSync({ email: 'foo@example.com' });

            expect(outcome.email).toEqual('foo@example.com');
        });

        it('should run a schema factory under runSync', () => {
            const validator = new Container<{ email: string }>();

            validator.mount('email', createValidator(() => z.string().email()));

            const outcome = validator.runSync({ email: 'foo@example.com' });

            expect(outcome.email).toEqual('foo@example.com');
        });

        it('should return the parsed value synchronously in sync mode', () => {
            const descriptor = createValidator(z.string().trim());

            expect(descriptor.run(buildContext(' foo ', true))).toEqual('foo');
        });

        it('should return a promise outside sync mode', async () => {
            const descriptor = createValidator(z.string().trim());

            const output = descriptor.run(buildContext(' foo '));

            expect(output).toBeInstanceOf(Promise);
            await expect(output).resolves.toEqual('foo');
        });

        it('should report the same issues under safeRunSync as under safeRun', async () => {
            const validator = new Container<{ email: string, age: number }>();

            validator.mount('email', createValidator(z.string().email()));
            validator.mount('age', createValidator(z.number().min(18)));

            const input = { email: 'foo', age: 3 };
            const syncOutcome = validator.safeRunSync(input);
            const asyncOutcome = await validator.safeRun(input);

            expect(syncOutcome.success).toBe(false);
            expect(asyncOutcome.success).toBe(false);

            if (syncOutcome.success || asyncOutcome.success) {
                return;
            }

            expect(syncOutcome.error.issues).toEqual(asyncOutcome.error.issues);

            const items = flattenIssueItems(syncOutcome.error.issues);

            expect(items.map((item) => item.code)).toEqual([IssueCode.EMAIL, IssueCode.MIN_VALUE]);
        });

        it('should throw a ValidupError under runSync', () => {
            const validator = new Container<{ email: string }>();

            validator.mount('email', createValidator(z.string().email()));

            expect(() => validator.runSync({ email: 'foo' })).toThrow(ValidupError);
        });

        it('should call an async refine exactly once under run', async () => {
            let calls = 0;
            const validator = new Container<{ name: string }>();

            validator.mount('name', createValidator(z.string().refine(async (value) => {
                calls++;

                return value === 'foo';
            })));

            await expect(validator.run({ name: 'foo' })).resolves.toEqual({ name: 'foo' });
            expect(calls).toEqual(1);

            const outcome = await validator.safeRun({ name: 'bar' });

            expect(calls).toEqual(2);
            expect(outcome.success).toBe(false);

            if (outcome.success) {
                return;
            }

            const items = flattenIssueItems(outcome.error.issues);

            expect(items).toHaveLength(1);
            expect(items[0].path).toEqual(['name']);
        });

        it('should surface an async schema under runSync as a structural violation', async () => {
            const unhandled: unknown[] = [];
            const listener = (reason: unknown) => {
                unhandled.push(reason);
            };

            process.on('unhandledRejection', listener);

            let calls = 0;

            try {
                const validator = new Container<{ name: string }>();

                validator.mount('name', createValidator(z.string().refine(async () => {
                    calls++;

                    return true;
                })));

                expect(() => validator.runSync({ name: 'foo' })).toThrow(
                    expect.objectContaining({ name: 'RunSyncViolationError' }),
                );
                expect(() => validator.safeRunSync({ name: 'foo' })).toThrow(
                    expect.objectContaining({ name: 'RunSyncViolationError' }),
                );

                await new Promise((resolve) => {
                    setTimeout(resolve, 10); 
                });
            } finally {
                process.off('unhandledRejection', listener);
            }

            expect(calls).toEqual(2);
            expect(unhandled).toEqual([]);
        });

        it('should propagate a non-zod error thrown by a refine in sync mode', () => {
            const error = new Error('boom');
            const descriptor = createValidator(z.string().refine(() => {
                throw error;
            }));

            expect(() => descriptor.run(buildContext('foo', true))).toThrow(error);
        });

        it('should propagate a non-zod error thrown by a refine outside sync mode', async () => {
            const error = new Error('boom');
            const descriptor = createValidator(z.string().refine(() => {
                throw error;
            }));

            await expect(descriptor.run(buildContext('foo'))).rejects.toBe(error);
        });
    });
});
