/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { flattenIssueItems } from '@ebec/core';
import type { Issue } from '@ebec/core';
import { Container } from '../../src';
import type { Result } from '../../src';

/**
 * Every mount runs a **pre-dispatch** region before its validator or child
 * container is invoked: path expansion, key preparation, the value read, and
 * the optional gate. All four touch the caller's input, so all four can throw
 * on an object that is merely *lazy* — an ORM entity with a deferred relation,
 * a class instance with a computed getter, a Vue reactive proxy.
 *
 * The invariant pinned here: such a throw is **attributed to its mount and
 * folded into the issue tree**, exactly like a validator throw. It must never
 * escape the run loop, because an escape discards every issue the earlier
 * mounts already collected and replaces the whole tree with one path-less item
 * — turning a real multi-field failure into a plausible-looking wrong answer.
 *
 * Historically the escape was real in all three run modes (issues #448 /
 * #449). The three modes are asserted together on purpose: the defect reached
 * `run`, `runSync` and `parallel: true` through different code (a twin body
 * and a separate scheduling loop), so a regression in one is not caught by the
 * others.
 */

type Modes = 'run' | 'runSync' | 'parallel';

const MODES: Modes[] = ['run', 'runSync', 'parallel'];

async function safeRunIn<T extends Record<string, any>>(
    mode: Modes,
    container: Container<T>,
    input: any,
): Promise<Result<T>> {
    if (mode === 'runSync') {
        return container.safeRunSync(input);
    }

    return container.safeRun(input, mode === 'parallel' ? { parallel: true } : {});
}

/** Assert failure and hand back the issue tree. */
function expectFailure<T extends Record<string, any>>(result: Result<T>): Issue[] {
    expect(result.success).toBe(false);
    if (result.success) {
        throw new Error('unreachable');
    }

    return result.error.issues;
}

/** `message` keyed by the leaf's dotted path, for order-free comparison. */
function messagesByPath(issues: Issue[]): Record<string, string> {
    const output: Record<string, string> = {};
    for (const leaf of flattenIssueItems(issues)) {
        output[leaf.path.join('.')] = leaf.message;
    }

    return output;
}

describe('pre-dispatch throw containment', () => {
    describe.each(MODES)('%s', (mode) => {
        it('should keep a sibling mount\'s issues when the value read throws', async () => {
            // The precondition is only "another mount also failed", i.e. the
            // normal case for an invalid request.
            const container = new Container<any>();
            container.mount('good', () => {
                throw new Error('REAL_ISSUE');
            });
            container.mount('lazy', (ctx) => ctx.value);

            const issues = expectFailure(await safeRunIn(mode, container, {
                good: 'x',
                get lazy(): unknown {
                    throw new Error('GETTER_BOOM');
                },
            }));

            expect(messagesByPath(issues)).toEqual({
                good: 'REAL_ISSUE',
                lazy: 'GETTER_BOOM',
            });
        });

        it('should attribute the throw to the mount rather than emitting it path-less', async () => {
            // `path: []` is the signature of a throw that escaped to
            // `wrapSafeRunError`. A mounted unit's failure must carry its key
            // so consumers (`@validup/vue`, i18n catalogs) can render it
            // against the right field.
            const container = new Container<any>();
            container.mount('lazy', (ctx) => ctx.value);

            const issues = expectFailure(await safeRunIn(mode, container, {
                get lazy(): unknown {
                    throw new Error('GETTER_BOOM');
                },
            }));

            const [leaf] = flattenIssueItems(issues);
            expect(leaf.path).toEqual(['lazy']);
            expect(leaf.message).toBe('GETTER_BOOM');
        });

        it('should keep a sibling mount\'s issues when the optional predicate throws', async () => {
            // `optional: (v) => v.trim().length === 0` — the mainstream
            // "blank means absent" idiom — throws a TypeError the first time
            // the field is genuinely absent.
            const container = new Container<any>();
            container.mount('good', () => {
                throw new Error('REAL_ISSUE');
            });
            container.mount(
                'flaky',
                { optional: () => { throw new Error('PREDICATE_BOOM'); } },
                () => 'never reached',
            );

            const issues = expectFailure(await safeRunIn(mode, container, { good: 'x', flaky: 'y' }));

            expect(messagesByPath(issues)).toEqual({
                good: 'REAL_ISSUE',
                flaky: 'PREDICATE_BOOM',
            });
        });

        it('should not stamp meta.optional when the predicate throws', async () => {
            // The stamp resolution re-invokes the predicate. It degrades to
            // "not optional" rather than propagating — a warning-severity
            // downgrade must not be inferred from a predicate that failed to
            // answer.
            const container = new Container<any>();
            container.mount(
                'flaky',
                { optional: () => { throw new Error('PREDICATE_BOOM'); } },
                () => 'never reached',
            );

            const issues = expectFailure(await safeRunIn(mode, container, { flaky: 'y' }));

            const [leaf] = flattenIssueItems(issues);
            expect(leaf.message).toBe('PREDICATE_BOOM');
            expect(leaf.meta?.optional).toBeUndefined();
            // Asserted alongside the stamp: an escaped predicate throw also
            // carries no `meta`, so without pinning the path this case would
            // stay green against the very defect it exists for.
            expect(leaf.path).toEqual(['flaky']);
        });

        it('should keep sibling issues when path expansion throws on a glob mount', async () => {
            // `expandPath` walks the input to resolve `*`, so it throws
            // *before* any key exists — the earliest of the four pre-dispatch
            // steps, and the one the original reports mis-attributed to the
            // value read.
            const container = new Container<any>();
            container.mount('good', () => {
                throw new Error('REAL_ISSUE');
            });
            container.mount('items.*.name', (ctx) => ctx.value);

            const issues = expectFailure(await safeRunIn(mode, container, {
                good: 'x',
                get items(): unknown {
                    throw new Error('EXPAND_BOOM');
                },
            }));

            const byPath = messagesByPath(issues);
            expect(byPath.good).toBe('REAL_ISSUE');
            // Attributed to the literal mount pattern: the keys it would have
            // expanded to are exactly what could not be computed.
            expect(byPath['items.*.name']).toBe('EXPAND_BOOM');
        });
    });

    it('should agree across all three run modes on the resulting issue tree', async () => {
        // The modes reach `collectExecutionFailure` through different code, so
        // pin that they converge rather than merely each being non-empty.
        const build = () => {
            const container = new Container<any>();
            container.mount('good', () => {
                throw new Error('REAL_ISSUE');
            });
            container.mount('lazy', (ctx) => ctx.value);
            return container;
        };

        const input = () => ({
            good: 'x',
            get lazy(): unknown {
                throw new Error('GETTER_BOOM');
            },
        });

        const [run, runSync, parallel] = [
            expectFailure(await safeRunIn('run', build(), input())),
            expectFailure(await safeRunIn('runSync', build(), input())),
            expectFailure(await safeRunIn('parallel', build(), input())),
        ];

        // Content first — three equally-broken modes also "agree", so the
        // cross-mode equality below only means something once the tree itself
        // is pinned.
        expect(messagesByPath(run)).toEqual({
            good: 'REAL_ISSUE',
            lazy: 'GETTER_BOOM',
        });
        expect(runSync).toEqual(run);
        expect(parallel).toEqual(run);
    });
});
