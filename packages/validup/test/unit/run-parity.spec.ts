/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { flattenIssueItems } from '@ebec/core';
import {
    Container,
    OptionalValue,
    ResultCache,
    defineValidator,
} from '../../src';
import type { Validator } from '../../src';
import { expectRunFailureParity, expectRunParity } from '../helpers/parity';
import { stringValidatorSync } from '../data';

const failing: Validator = () => {
    throw new Error('nope');
};

/**
 * `run` and `runSync` are two drivers over one twin body
 * (`Container.runBody`), so every mount-resolution rule has to resolve
 * identically on both. These are the table-driven assertions of that contract
 * — the per-variant specs (`module.spec.ts`, `run-sync.spec.ts`,
 * `optional.spec.ts`, …) keep covering the behaviour itself.
 */
describe('run/runSync parity', () => {
    it('should agree on a plain successful run', async () => {
        const container = new Container<{ name: string, age: number }>();
        container.mount('name', stringValidatorSync);
        container.mount('age', (ctx) => ctx.value);

        const output = await expectRunParity(container, { name: 'Peter', age: 30 });
        expect(output).toEqual({ name: 'Peter', age: 30 });
    });

    it('should agree on the sequential chain-read of a sanitized sibling', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', (ctx) => String(ctx.value).trim());
        container.mount('name', (ctx) => `${ctx.value}!`);

        const output = await expectRunParity(container, { name: '  Peter  ' });
        expect(output).toEqual({ name: 'Peter!' });
    });

    describe('optional gate', () => {
        it('should agree on the boolean gate + default optionalValue', async () => {
            const container = new Container<{ name: string }>();
            container.mount('name', { optional: true }, stringValidatorSync);

            const output = await expectRunParity(container, {});
            expect(Object.keys(output)).toHaveLength(0);
        });

        it('should agree on a predicate gate winning over the atom vocabulary', async () => {
            const container = new Container<{ name: string }>();
            container.mount(
                'name',
                {
                    optional: (value) => value === 'skip',
                    optionalValue: OptionalValue.UNDEFINED,
                },
                failing,
            );

            const output = await expectRunParity(container, { name: 'skip' });
            expect(Object.keys(output)).toHaveLength(0);
        });

        it('should agree on optionalInclude copying the input through', async () => {
            const container = new Container<{ name: string }>();
            container.mount(
                'name',
                {
                    optional: true,
                    optionalValue: OptionalValue.EMPTY_STRING,
                    optionalInclude: true,
                },
                failing,
            );

            const output = await expectRunParity(container, { name: '' });
            expect(output).toEqual({ name: '' });
        });

        it('should agree on the array (any-of) optionalValue form', async () => {
            const container = new Container<{ name: string }>();
            container.mount(
                'name',
                {
                    optional: true,
                    optionalValue: [OptionalValue.NULL, OptionalValue.EMPTY_STRING],
                },
                failing,
            );

            expect(Object.keys(await expectRunParity(container, { name: null as any }))).toHaveLength(0);
            expect(Object.keys(await expectRunParity(container, { name: '' }))).toHaveLength(0);
        });

        it('should agree on a throwing predicate failing only its own mount', async () => {
            // The gate runs the predicate once, and the `meta.optional` stamp
            // re-runs it inside the error path. Both variants must contain the
            // throw and attribute it to `flaky`, leaving `other`'s issue
            // intact — an escape from either site collapses the whole tree to
            // one path-less item, identically in both drivers, so the failure
            // mode is invisible without asserting the tree itself.
            const container = new Container<{ other: string, flaky: string }>();
            container.mount('other', stringValidatorSync);
            container.mount(
                'flaky',
                { optional: () => { throw new Error('PREDICATE_BOOM'); } },
                stringValidatorSync,
            );

            const issues = await expectRunFailureParity(container, { other: 1 as any, flaky: 'x' });

            expect(flattenIssueItems(issues as any).map((i) => [i.path.join('.'), i.message])).toEqual([
                ['other', 'Value is not a string'],
                ['flaky', 'PREDICATE_BOOM'],
            ]);
        });
    });

    describe('optionalValue precedence', () => {
        it('should agree that the mount layer wins over run and container', async () => {
            const container = new Container<{ name: string }>({ optionalValue: OptionalValue.NULL });
            container.mount(
                'name',
                {
                    optional: true,
                    optionalValue: OptionalValue.EMPTY_STRING,
                },
                failing,
            );

            expect(Object.keys(await expectRunParity(
                container,
                { name: '' },
                { optionalValue: OptionalValue.ZERO },
            ))).toHaveLength(0);
        });

        it('should agree that the run layer wins over the container layer', async () => {
            const container = new Container<{ name: string }>({ optionalValue: OptionalValue.NULL });
            container.mount('name', { optional: true }, failing);

            expect(Object.keys(await expectRunParity(
                container,
                { name: '' },
                { optionalValue: OptionalValue.EMPTY_STRING },
            ))).toHaveLength(0);
        });

        it('should agree on the container layer as the last stop before the default', async () => {
            const container = new Container<{ name: string }>({ optionalValue: OptionalValue.EMPTY_STRING });
            container.mount('name', { optional: true }, failing);

            expect(Object.keys(await expectRunParity(container, { name: '' }))).toHaveLength(0);
        });
    });

    describe('optionalAs precedence', () => {
        it('should agree that the mount layer wins', async () => {
            const container = new Container<{ name: string }>({ optionalAs: 'container' });
            container.mount('name', { optional: true, optionalAs: 'mount' }, failing);

            expect(await expectRunParity(container, {}, { optionalAs: 'run' }))
                .toEqual({ name: 'mount' });
        });

        it('should agree that the run layer wins over the container layer', async () => {
            const container = new Container<{ name: string }>({ optionalAs: 'container' });
            container.mount('name', { optional: true }, failing);

            expect(await expectRunParity(container, {}, { optionalAs: 'run' }))
                .toEqual({ name: 'run' });
        });

        it('should agree that presence — not value — activates the directive', async () => {
            const container = new Container<{ name: string }>();
            container.mount('name', { optional: true, optionalAs: undefined }, failing);

            const output = await expectRunParity(container, {});
            // Key present, value `undefined` — distinct from "omit the key".
            expect(Object.keys(output)).toEqual(['name']);
            expect(output.name).toBeUndefined();
        });

        it('should agree that optionalAs outranks optionalInclude', async () => {
            const container = new Container<{ name: string }>();
            container.mount(
                'name',
                {
                    optional: true,
                    optionalValue: OptionalValue.EMPTY_STRING,
                    optionalAs: null,
                    optionalInclude: true,
                },
                failing,
            );

            expect(await expectRunParity(container, { name: '' })).toEqual({ name: null });
        });
    });

    describe('nested containers', () => {
        it('should agree on nested output merging', async () => {
            const child = new Container<{ city: string }>();
            child.mount('city', stringValidatorSync);

            const parent = new Container<{ address: { city: string } }>();
            parent.mount('address', child);

            expect(await expectRunParity(parent, { address: { city: 'Berlin' } }))
                .toEqual({ address: { city: 'Berlin' } });
        });

        it('should agree on the forwarded optionalValue / optionalAs bag', async () => {
            const child = new Container<{ city: string }>();
            child.mount('city', { optional: true }, failing);

            const parent = new Container<{ address: { city: string } }>();
            parent.mount('address', child);

            expect(await expectRunParity(
                parent,
                { address: { city: '' } },
                {
                    optionalValue: OptionalValue.EMPTY_STRING,
                    optionalAs: null,
                },
            )).toEqual({ address: { city: null } });
        });

        it('should agree on the forwarded defaults slice', async () => {
            const child = new Container<{ city: string, zip: string }>();
            child.mount('city', stringValidatorSync);

            const parent = new Container<{ address: { city: string, zip: string } }>();
            parent.mount('address', child);

            expect(await expectRunParity(
                parent,
                { address: { city: 'Berlin' } },
                { defaults: { 'address.zip': '10115' } as any },
            )).toEqual({ address: { city: 'Berlin', zip: '10115' } });
        });

        it('should agree on nested issue paths', async () => {
            const child = new Container<{ city: string }>();
            child.mount('city', failing);

            const parent = new Container<{ address: { city: string } }>();
            parent.mount('address', child);

            const issues = await expectRunFailureParity(parent, { address: { city: 1 as any } });
            expect(flattenIssueItems(issues as any).map((item) => item.path))
                .toEqual([['address', 'city']]);
        });
    });

    describe('filters and groups', () => {
        it('should agree on group filtering', async () => {
            const container = new Container<{ name: string, age: number }>();
            container.mount('name', { group: ['create'] }, stringValidatorSync);
            container.mount('age', { group: ['update'] }, failing);

            expect(await expectRunParity(
                container,
                { name: 'Peter', age: 30 },
                { group: 'create' },
            )).toEqual({ name: 'Peter' });
        });

        it('should agree on pathsToInclude / pathsToExclude', async () => {
            const container = new Container<{ name: string, age: number }>();
            container.mount('name', stringValidatorSync);
            container.mount('age', failing);

            expect(await expectRunParity(
                container,
                { name: 'Peter', age: 30 },
                { pathsToInclude: ['name'] },
            )).toEqual({ name: 'Peter' });

            expect(await expectRunParity(
                container,
                { name: 'Peter', age: 30 },
                { pathsToExclude: ['age'] },
            )).toEqual({ name: 'Peter' });
        });

        it('should agree on defaults backfill', async () => {
            const container = new Container<{ name: string, age: number }>();
            container.mount('name', stringValidatorSync);

            expect(await expectRunParity(
                container,
                { name: 'Peter' },
                { defaults: { age: 30 } },
            )).toEqual({ name: 'Peter', age: 30 });
        });

        it('should agree on flat output', async () => {
            const child = new Container<{ city: string }>();
            child.mount('city', stringValidatorSync);

            const parent = new Container<{ address: { city: string } }>();
            parent.mount('address', child);

            expect(await expectRunParity(
                parent,
                { address: { city: 'Berlin' } },
                { flat: true },
            )).toEqual({ 'address.city': 'Berlin' });
        });
    });

    describe('failures', () => {
        it('should agree on the aggregated issue tree', async () => {
            const container = new Container<{ name: string, age: number }>();
            container.mount('name', failing);
            container.mount('age', failing);

            const issues = await expectRunFailureParity(container, { name: 1 as any, age: 'x' as any });
            expect(issues).toHaveLength(2);
        });

        it('should agree on the meta.optional stamp for a boolean-optional mount', async () => {
            // `optional: true` tags unconditionally — the stamp reflects the
            // mount's *declaration*, not whether the gate fired for this value.
            const container = new Container<{ name: string }>();
            container.mount(
                'name',
                {
                    optional: true,
                    optionalValue: OptionalValue.EMPTY_STRING,
                },
                failing,
            );

            const issues = await expectRunFailureParity(container, { name: 'x' });
            expect(flattenIssueItems(issues as any)[0].meta).toEqual({ optional: true });
        });

        it('should agree that a predicate-optional mount is re-evaluated at error time', async () => {
            const container = new Container<{ name: string }>();
            container.mount(
                'name',
                { optional: (value) => value === 'skip' },
                failing,
            );

            const issues = await expectRunFailureParity(container, { name: 'x' });
            expect(flattenIssueItems(issues as any)[0].meta).toBeUndefined();
        });

        it('should agree that meta.optional is not inherited by a child container leaf', async () => {
            const child = new Container<{ city: string }>();
            child.mount('city', failing);

            const parent = new Container<{ address: { city: string } }>();
            parent.mount('address', { optional: true }, child);

            const issues = await expectRunFailureParity(parent, { address: { city: 1 as any } });
            // Wrapping group carries the flag; the leaf inside does not.
            expect((issues[0] as any).meta).toEqual({ optional: true });
            expect(flattenIssueItems(issues as any)[0].meta).toBeUndefined();
        });

        it('should agree on oneOf aggregation when every branch fails', async () => {
            const container = new Container<{ name: string, age: number }>({ oneOf: true });
            container.mount('name', failing);
            container.mount('age', failing);

            const issues = await expectRunFailureParity(container, { name: 1 as any, age: 'x' as any });
            expect(issues).toHaveLength(1);
        });

        it('should agree on oneOf succeeding when one branch passes', async () => {
            const container = new Container<{ name: string, age: number }>({ oneOf: true });
            container.mount('name', stringValidatorSync);
            container.mount('age', failing);

            expect(await expectRunParity(container, { name: 'Peter', age: 30 }))
                .toEqual({ name: 'Peter' });
        });
    });

    describe('result cache', () => {
        it('should agree that a hit is replayed rather than re-invoked', async () => {
            let calls = 0;
            const container = new Container<{ name: string }>();
            container.mount('name', (ctx) => {
                calls++;
                return ctx.value;
            });

            const cache = new ResultCache();
            // Seed via `run`, replay via `runSync` — one shared cache, one
            // shared body, so the second variant must not re-invoke.
            expect(await container.run({ name: 'Peter' }, { cache })).toEqual({ name: 'Peter' });
            expect(calls).toEqual(1);
            expect(container.runSync({ name: 'Peter' }, { cache })).toEqual({ name: 'Peter' });
            expect(calls).toEqual(1);
        });

        it('should agree that a sideEffect mount is never cached', async () => {
            let calls = 0;
            const container = new Container<{ name: string }>();
            container.mount('name', defineValidator({
                sideEffect: true,
                run: (ctx) => {
                    calls++;
                    return ctx.value;
                },
            }));

            const cache = new ResultCache();
            await container.run({ name: 'Peter' }, { cache });
            container.runSync({ name: 'Peter' }, { cache });

            expect(calls).toEqual(2);
        });

        it('should agree that a failure outcome replays as a failure', async () => {
            let calls = 0;
            const container = new Container<{ name: string }>();
            container.mount('name', () => {
                calls++;
                throw new Error('nope');
            });

            const cache = new ResultCache();
            const async = await container.safeRun({ name: 'x' }, { cache });
            const sync = container.safeRunSync({ name: 'x' }, { cache });

            expect(calls).toEqual(1);
            expect(async.success).toEqual(false);
            expect(sync.success).toEqual(false);
            if (!async.success && !sync.success) {
                expect(sync.error.issues).toEqual(async.error.issues);
            }
        });
    });
});
