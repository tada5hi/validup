/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import {
    Container,
    defineSchema,
    defineValidator,
    isContainer,
    isObject,
    isValidatorDescriptor,
} from '../../src';

/**
 * Minimal duck-typed container. Satisfies `isContainer` (has `run` +
 * `safeRun`) without being an instance of `Container` — the shape an adapter
 * or a duplicate package copy would hand in.
 */
function createContainerLike(run: (...args: any[]) => any) {
    return {
        run,
        safeRun: async (...args: any[]) => ({ success: true, data: run(...args) }),
    };
}

describe('Container.mount — argument dispatch', () => {
    // `mount(...args)` classifies each argument by walking a chain of
    // predicates. Several of those predicates overlap on the same value, so
    // the ORDER of the branches is load-bearing. These specs pin the order by
    // asserting the mount kind that actually gets registered — they fail if
    // the branches in `container/module.ts` are reordered.

    it('registers an object exposing run + safeRun as a container mount, not as MountOptions', async () => {
        // The very shape that overlaps: it satisfies `isContainer` AND the
        // generic `isObject` MountOptions branch further down the chain.
        const run = vi.fn(() => ({ inner: 'ok' }));
        const containerLike = createContainerLike(run);

        expect(isContainer(containerLike)).toBe(true);
        expect(isObject(containerLike)).toBe(true);

        const container = new Container<{ child: { inner: string } }>();
        container.mount('child', containerLike as any);

        // Structural: the mount landed in the container branch.
        const item = (container as any).items[0];
        expect(item.type).toBe('container');
        expect(item.data).toBe(containerLike);

        // Behavioural (survives a refactor of the `Mount` union): a container
        // mount is invoked as `child.run(value, childOptions)` — two args, the
        // first being the raw value object. A validator mount would receive a
        // single `ValidatorContext` carrying `key` / `value` / `path`.
        const output = await container.run({ child: { inner: 'raw' } });
        expect(output).toEqual({ child: { inner: 'ok' } });

        expect(run).toHaveBeenCalledTimes(1);
        expect(run.mock.calls[0]).toHaveLength(2);
        expect(run.mock.calls[0][0]).toEqual({ inner: 'raw' });
        expect(isObject(run.mock.calls[0][1])).toBe(true);
    });

    it('registers a ValidatorDescriptor as a validator mount, not as MountOptions', async () => {
        // Second overlap: a descriptor is also a plain object, so
        // `isValidatorDescriptor` must be consulted before `isObject`.
        const descriptor = defineValidator<unknown, string>({
            sideEffect: true,
            run: (ctx) => `${ctx.value}!`,
        });

        expect(isValidatorDescriptor(descriptor)).toBe(true);
        expect(isObject(descriptor)).toBe(true);

        const container = new Container<{ foo: string }>();
        container.mount('foo', descriptor);

        const item = (container as any).items[0];
        expect(item.type).toBe('validator');
        // The stored callee is the descriptor's `run`, not the descriptor.
        expect(item.data).toBe(descriptor.run);
        expect(item.sideEffect).toBe(true);

        expect(await container.run({ foo: 'x' })).toEqual({ foo: 'x!' });
    });

    it('still separates a MountOptions object from the mounted unit when both are passed', async () => {
        const run = vi.fn(() => ({ inner: 'ok' }));
        const containerLike = createContainerLike(run);

        const container = new Container<{ child: { inner: string } }>();
        container.mount('child', { group: 'create' }, containerLike as any);

        const item = (container as any).items[0];
        expect(item.type).toBe('container');
        expect(item.options).toEqual({ group: 'create' });

        // Group-filtered out — the container mount never runs.
        expect(await container.run({ child: { inner: 'raw' } }, { group: 'update' })).toEqual({});
        expect(run).not.toHaveBeenCalled();
    });

    it('keeps isContainer and isValidatorDescriptor mutually exclusive', () => {
        // The negative `safeRun` check inside `isValidatorDescriptor` is what
        // makes a single object unable to satisfy both guards. Drop it and the
        // relative order of the two branches suddenly becomes the only thing
        // preventing a container from being registered as a validator — pin it
        // here so that regression is caught at the guard, not downstream.
        const containerLike = createContainerLike(() => ({}));
        expect(isContainer(containerLike)).toBe(true);
        expect(isValidatorDescriptor(containerLike)).toBe(false);

        const descriptor = defineValidator({ run: (ctx) => ctx.value });
        expect(isValidatorDescriptor(descriptor)).toBe(true);
        expect(isContainer(descriptor)).toBe(false);

        const container = new Container();
        expect(isContainer(container)).toBe(true);
        expect(isValidatorDescriptor(container)).toBe(false);
    });
});

describe('isContainer', () => {
    // Three-clause duck type: object (not array/null) + `run` function +
    // `safeRun` function. Duck-typed rather than `instanceof` so containers
    // from a duplicate package copy or another realm still round-trip.

    it('accepts a real Container instance', () => {
        expect(isContainer(new Container())).toBe(true);
    });

    it('accepts a duck-typed object carrying run + safeRun', () => {
        expect(isContainer(createContainerLike(() => ({})))).toBe(true);
    });

    it('accepts an instance whose run/safeRun live on the prototype', () => {
        // Property lookup walks the prototype chain — the reason the guard can
        // stand in for `instanceof` across realms / duplicate installs.
        class Foreign {
            run() {
                return {};
            }

            safeRun() {
                return { success: true, data: {} };
            }
        }

        expect(isContainer(new Foreign())).toBe(true);
    });

    it('rejects a descriptor-shaped object (run without safeRun)', () => {
        expect(isContainer({ run: () => ({}) })).toBe(false);
    });

    it('rejects an object carrying safeRun only', () => {
        expect(isContainer({ safeRun: () => ({}) })).toBe(false);
    });

    it('rejects a Builder', () => {
        expect(isContainer(defineSchema())).toBe(false);
    });

    it('rejects non-objects and arrays', () => {
        expect(isContainer(() => ({}))).toBe(false);
        expect(isContainer([])).toBe(false);
        expect(isContainer(null)).toBe(false);
        expect(isContainer(undefined)).toBe(false);
        expect(isContainer('container')).toBe(false);
        expect(isContainer(42)).toBe(false);
    });
});

describe('Builder.mount — target dispatch', () => {
    // Unlike `Container.mount`, the builder's guards genuinely overlap: an
    // object exposing `build` + `mount` + `run` + `safeRun` satisfies both
    // `isBuilder` and `isContainer`. Reversing the two branches in
    // `builder/module.ts` flips every assertion below.

    it('prefers the builder branch for a target satisfying isBuilder AND isContainer', async () => {
        const built = new Container<{ marker: string }>();
        built.mount('marker', () => 'from-build');

        const build = vi.fn(() => built);
        const run = vi.fn(async () => ({ marker: 'from-run' }));
        const hybrid: any = {
            build,
            mount: () => hybrid,
            run,
            safeRun: async () => ({ success: true, data: { marker: 'from-run' } }),
        };

        // Both guards say yes — order decides which one wins.
        expect(isContainer(hybrid)).toBe(true);

        const container = defineSchema().mount('child', hybrid).build();
        const output = await container.run({ child: { marker: 'raw' } });

        // `build()` was consulted at mount time and its result became the child.
        expect(build).toHaveBeenCalledTimes(1);
        // The hybrid itself was never treated as the child container.
        expect(run).not.toHaveBeenCalled();
        expect(output).toEqual({ child: { marker: 'from-build' } });
    });

    it('materializes a nested builder at mount time', () => {
        const child = defineSchema().mount('city', (ctx) => String(ctx.value));
        const parent = defineSchema().mount('address', child).build();

        // A Builder is NOT a container — the step must hold the built result.
        expect(isContainer(child)).toBe(false);

        const item = (parent as any).items[0];
        expect(item.type).toBe('container');
        expect(item.data).toBeInstanceOf(Container);
    });

    it('mounts an existing Container as-is', async () => {
        const child = new Container<{ city: string }>();
        child.mount('city', (ctx) => String(ctx.value));

        const parent = defineSchema().mount('address', child).build();

        const item = (parent as any).items[0];
        expect(item.type).toBe('container');
        // No `build()` indirection for a real container — it is the child.
        expect(item.data).toBe(child);

        expect(await parent.run({ address: { city: 'Berlin' } }))
            .toEqual({ address: { city: 'Berlin' } });
    });

    it('falls through to the validator branch for a bare function', async () => {
        const parent = defineSchema().mount('name', (ctx) => String(ctx.value)).build();

        const item = (parent as any).items[0];
        expect(item.type).toBe('validator');

        expect(await parent.run({ name: 'Peter' })).toEqual({ name: 'Peter' });
    });
});
