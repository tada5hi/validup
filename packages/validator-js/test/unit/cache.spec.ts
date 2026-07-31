/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import validator from 'validator';
import { describe, expect, it } from 'vitest';
import {
    Container,
    IssueCode,
    ResultCache,
    defineValidator,
    flattenIssueItems,
    isValidupError,
} from 'validup';
import type { ValidatorDescriptor } from 'validup';
import {
    createValidator,
    equals,
    isEmail,
} from '../../src';

/**
 * The `sideEffect` flag is metadata until something consults it. These specs
 * drive a real `Container` with a real `ResultCache` so the flag's *effect* is
 * asserted, not just its value — `factories.spec.ts` and `issue-shape.spec.ts`
 * already pin the boolean.
 *
 * `equals(key)` (no `expectedValue`) is the only place in this package where
 * the flag is load-bearing: its comparison target is a SIBLING field read
 * through `getPathValue(ctx.data, key)`, and the cache snapshot captures only
 * `(value, context, group)`. A sibling can therefore change while the snapshot
 * stays byte-identical — the exact shape a stale cache hit would mis-serve.
 */

/**
 * Re-wrap a descriptor so invocations can be counted while preserving the
 * declared `sideEffect` — `Container.mount` reads the flag off the descriptor
 * at mount time, so it must survive the wrap or the spy would change the very
 * behaviour under test.
 */
function spyOn(descriptor: ValidatorDescriptor<unknown>): {
    descriptor: ValidatorDescriptor<unknown>,
    calls: () => number,
} {
    let calls = 0;
    return {
        descriptor: {
            sideEffect: descriptor.sideEffect,
            run: (ctx) => {
                calls += 1;
                return descriptor.run(ctx);
            },
        },
        calls: () => calls,
    };
}

describe('equals(): sideEffect makes the sibling read cache-safe', () => {
    it('re-runs after the sibling changes, even though its own value did not', async () => {
        // The whole point, end to end. `passwordConfirm` holds 'hunter2' in
        // BOTH runs — value, context and group are identical, so the cache
        // snapshot matches exactly. Only `password` moved. Without
        // `sideEffect: true` the run-2 outcome would be replayed from run 1
        // and the mismatch would go unreported.
        const container = new Container<{ password: string, passwordConfirm: string }>();
        container.mount('passwordConfirm', equals('password'));

        const cache = new ResultCache();

        const first = await container.safeRun(
            { password: 'hunter2', passwordConfirm: 'hunter2' },
            { cache },
        );
        expect(first.success).toBe(true);

        const second = await container.safeRun(
            { password: 'CHANGED', passwordConfirm: 'hunter2' },
            { cache },
        );

        expect(second.success).toBe(false);
        if (second.success) return;
        const items = flattenIssueItems(
            isValidupError(second.error) ? second.error.issues : [],
        );
        expect(items[0]?.code).toBe(IssueCode.SAME_AS);
        expect(items[0]?.data).toEqual({ other: 'password' });
    });

    it('a cache-eligible twin of the same validator DOES go stale', async () => {
        // The counterfactual that makes the test above non-vacuous. Same
        // closure, same sibling read — only the flag is dropped. If this
        // passed a second time for the RIGHT reason (i.e. the cache never
        // engaged) the test above would prove nothing; instead the stale
        // success here shows the cache is live and would have swallowed the
        // mismatch.
        const sibling = equals<unknown>('password');
        const withoutFlag = defineValidator<unknown>({ run: sibling.run });

        const container = new Container<{ password: string, passwordConfirm: string }>();
        container.mount('passwordConfirm', withoutFlag);

        const cache = new ResultCache();
        await container.safeRun({ password: 'hunter2', passwordConfirm: 'hunter2' }, { cache });
        const stale = await container.safeRun({ password: 'CHANGED', passwordConfirm: 'hunter2' }, { cache });

        // Stale hit: the mismatch is NOT reported.
        expect(stale.success).toBe(true);

        // …and drops out the moment the cache is not consulted.
        const uncached = await container.safeRun({ password: 'CHANGED', passwordConfirm: 'hunter2' });
        expect(uncached.success).toBe(false);
    });

    it('invokes the sibling-reading validator once per run', async () => {
        const spy = spyOn(equals<unknown>('password'));
        const container = new Container<{ password: string, passwordConfirm: string }>();
        container.mount('passwordConfirm', spy.descriptor);

        const cache = new ResultCache();
        const data = { password: 'hunter2', passwordConfirm: 'hunter2' };
        await container.safeRun(data, { cache });
        await container.safeRun(data, { cache });
        await container.safeRun(data, { cache });

        // Three runs, three invocations — the cache never short-circuits it.
        expect(spy.calls()).toBe(3);
    });

    it('caches the expectedValue arm — no sibling read, no staleness risk', async () => {
        // The mirror image: `expectedValue` makes the validator a pure
        // function of `ctx.value`, so `sideEffect` is false and the cache is
        // free to replay. Asserting only the boolean would leave this half of
        // the contract unproven.
        const descriptor = equals<unknown>('password', { expectedValue: 'hunter2' });
        expect(descriptor.sideEffect).toBe(false);

        const spy = spyOn(descriptor);
        const container = new Container<{ passwordConfirm: string }>();
        container.mount('passwordConfirm', spy.descriptor);

        const cache = new ResultCache();
        await container.safeRun({ passwordConfirm: 'hunter2' }, { cache });
        await container.safeRun({ passwordConfirm: 'hunter2' }, { cache });

        expect(spy.calls()).toBe(1);
    });

    it('re-runs the cached arm when the value itself changes', () => {
        // Cache-eligible is not cache-frozen: the snapshot still tracks
        // `ctx.value`, so a keystroke invalidates it.
        const spy = spyOn(equals<unknown>('password', { expectedValue: 'hunter2' }));
        const container = new Container<{ passwordConfirm: string }>();
        container.mount('passwordConfirm', spy.descriptor);

        const cache = new ResultCache();
        container.safeRunSync({ passwordConfirm: 'hunter2' }, { cache });
        container.safeRunSync({ passwordConfirm: 'hunter' }, { cache });
        container.safeRunSync({ passwordConfirm: 'hunter2' }, { cache });

        expect(spy.calls()).toBe(3);
    });
});

describe('createValidator(): the generic escape hatch honours the cache', () => {
    // Parity with `@validup/zod` and `@validup/standard-schema`, which both
    // carry this pair. Until now `@validup/validator-js` never imported
    // `ResultCache` in any spec.

    it('participates in the result cache by default', async () => {
        let calls = 0;
        const container = new Container<{ card: string }>();
        container.mount('card', createValidator(
            (value: string) => {
                calls += 1;
                return validator.isCreditCard(value);
            },
            { code: 'credit_card' },
        ));

        const cache = new ResultCache();
        const data = { card: '4111111111111111' };
        await container.run(data, { cache });
        await container.run(data, { cache });

        expect(calls).toBe(1);
    });

    it('bypasses the cache when sideEffect: true is opted into', async () => {
        let calls = 0;
        const container = new Container<{ card: string }>();
        container.mount('card', createValidator(
            (value: string) => {
                calls += 1;
                return validator.isCreditCard(value);
            },
            { code: 'credit_card', sideEffect: true },
        ));

        const cache = new ResultCache();
        const data = { card: '4111111111111111' };
        await container.run(data, { cache });
        await container.run(data, { cache });

        expect(calls).toBe(2);
    });

    it('replays a cached FAILURE rather than re-invoking the predicate', async () => {
        // The cache stores the raw outcome, success or throw. A failing
        // predicate must not be re-invoked on the second run, and the issue
        // must still be rebuilt with the right code.
        let calls = 0;
        const container = new Container<{ card: string }>();
        container.mount('card', createValidator(
            () => {
                calls += 1;
                return false;
            },
            { code: 'credit_card', message: 'nope' },
        ));

        const cache = new ResultCache();
        const data = { card: 'bad' };
        const first = await container.safeRun(data, { cache });
        const second = await container.safeRun(data, { cache });

        expect(calls).toBe(1);
        expect(first.success).toBe(false);
        expect(second.success).toBe(false);
        if (second.success) return;
        const items = flattenIssueItems(isValidupError(second.error) ? second.error.issues : []);
        expect(items[0]?.code).toBe('credit_card');
        expect(items[0]?.path).toEqual(['card']);
    });
});

describe('pre-baked factories are cache-eligible', () => {
    it('isEmail leaves sideEffect unset and replays from the cache', async () => {
        // Representative of the 15 factories that read nothing but the
        // stringified value. If a future factory started reading `ctx.data`
        // without stamping the flag, this is the shape that would go stale.
        const descriptor = isEmail<unknown>();
        expect(descriptor.sideEffect).toBeUndefined();

        const spy = spyOn(descriptor);
        const container = new Container<{ email: string }>();
        container.mount('email', spy.descriptor);

        const cache = new ResultCache();
        const data = { email: 'user@example.com' };
        await container.run(data, { cache });
        await container.run(data, { cache });

        expect(spy.calls()).toBe(1);
    });
});
