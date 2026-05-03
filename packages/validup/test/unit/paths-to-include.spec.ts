/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { Container } from '../../src';
import { stringValidator } from '../data';

describe('oneOf', () => {
    it('should execute only specific mount item', async () => {
        const container = new Container<{ foo: string, bar: string }>({ pathsToInclude: ['foo'] });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({
            foo: 'boz',
            bar: 'baz',
        });

        expect(output.foo).toEqual('boz');
        expect(output.bar).toBeUndefined();
    });

    it('should not execute any mount item', async () => {
        const container = new Container<{ foo: string, bar: string }>({ pathsToInclude: [] });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({
            foo: 'boz',
            bar: 'baz',
        });

        expect(output.foo).toBeUndefined();
        expect(output.bar).toBeUndefined();
    });

    it('should honor container-level pathsToExclude', async () => {
        const container = new Container<{ foo: string, bar: string }>({ pathsToExclude: ['bar'] });

        container.mount('foo', stringValidator);
        container.mount('bar', stringValidator);

        const output = await container.run({
            foo: 'boz',
            bar: 'baz',
        });

        expect(output.foo).toEqual('boz');
        expect(output.bar).toBeUndefined();
    });

    it('should strip the mount key prefix when forwarding filters to a nested container', async () => {
        const childOptionsSeen: any[] = [];
        const child = {
            run: (async (input: any, opts: any = {}) => {
                childOptionsSeen.push(opts);
                return input;
            }),
            safeRun: (async () => ({ success: true, data: {} })),
        };

        const parent = new Container<{ nested: Record<string, unknown> }>();
        parent.mount('nested', child as any);

        await parent.run(
            { nested: { qux: 'two', skip: 'three' } },
            { pathsToInclude: ['nested.qux'], pathsToExclude: ['nested.skip'] },
        );

        expect(childOptionsSeen).toHaveLength(1);
        expect(childOptionsSeen[0].pathsToInclude).toEqual(['qux']);
        expect(childOptionsSeen[0].pathsToExclude).toEqual(['skip']);
    });

    it('should forward an unconstrained pathsToInclude when the parent matches exact key', async () => {
        const childOptionsSeen: any[] = [];
        const child = {
            run: (async (input: any, opts: any = {}) => {
                childOptionsSeen.push(opts);
                return input;
            }),
            safeRun: (async () => ({ success: true, data: {} })),
        };

        const parent = new Container<{ nested: Record<string, unknown> }>();
        parent.mount('nested', child as any);

        await parent.run({ nested: {} }, { pathsToInclude: ['nested'] });

        expect(childOptionsSeen).toHaveLength(1);
        expect(childOptionsSeen[0].pathsToInclude).toBeUndefined();
    });

    it('should validate only the targeted path in a nested container with pathsToInclude', async () => {
        const child = new Container<{ baz: string, qux: string }>();
        child.mount('baz', stringValidator);
        child.mount('qux', stringValidator);

        const parent = new Container<{ nested: { baz: string, qux: string } }>();
        parent.mount('nested', child);

        const output = await parent.run(
            { nested: { baz: 'one', qux: 'two' } },
            { pathsToInclude: ['nested.qux'] },
        );

        expect(output.nested?.qux).toEqual('two');
        expect(output.nested?.baz).toBeUndefined();
    });

    it('should skip the targeted path in a nested container with pathsToExclude', async () => {
        const child = new Container<{ baz: string, qux: string }>();
        child.mount('baz', stringValidator);
        child.mount('qux', stringValidator);

        const parent = new Container<{ nested: { baz: string, qux: string } }>();
        parent.mount('nested', child);

        const output = await parent.run(
            { nested: { baz: 'one', qux: 'two' } },
            { pathsToExclude: ['nested.qux'] },
        );

        expect(output.nested?.baz).toEqual('one');
        expect(output.nested?.qux).toBeUndefined();
    });

    it('should skip leaf validators when pathsToInclude only matches deeper paths', async () => {
        const container = new Container<{ foo: string }>();
        container.mount('foo', stringValidator);

        const output = await container.run(
            { foo: 'bar' },
            { pathsToInclude: ['foo.deeper'] },
        );

        expect(output.foo).toBeUndefined();
    });

    it('should run leaf validators when pathsToExclude only targets deeper paths', async () => {
        const container = new Container<{ foo: string }>();
        container.mount('foo', stringValidator);

        const output = await container.run(
            { foo: 'bar' },
            { pathsToExclude: ['foo.deeper'] },
        );

        expect(output.foo).toEqual('bar');
    });
});
