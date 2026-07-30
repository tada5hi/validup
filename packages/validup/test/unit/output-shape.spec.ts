/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { Container } from '../../src';

/**
 * `finalizeOutput` expands the flat, dotted-key output back into a nested
 * object with `setPathValue` whenever `flat` is false — which is the default.
 *
 * Until pathtrace 2.2.3 that expansion built `{ items: { '0': [] } }` for a
 * mount over an array: the value landed on an array as a non-index property,
 * so it read back in memory but vanished through `JSON.stringify` and
 * `structuredClone` — i.e. in any API response body.
 *
 * The pre-existing glob specs missed it because they all pass `{ flat: true }`
 * (the branch that skips `setPathValue` entirely) and use object keys rather
 * than array indices. These cases therefore assert the **serialized** shape
 * under the default run mode, which is the only thing that catches it.
 */
describe('nested output reconstruction', () => {
    const echo = (ctx: { value: unknown }) => ctx.value;

    it('rebuilds an array from a glob mount', async () => {
        const container = new Container();
        container.mount('items.*.name', echo);

        const input = { items: [{ name: 'alpha' }, { name: 'beta' }] };
        const output = await container.run(input);

        expect(Array.isArray((output as any).items)).toBe(true);
        expect(JSON.parse(JSON.stringify(output))).toEqual(input);
    });

    it('rebuilds an array from an explicit numeric path', async () => {
        const container = new Container();
        container.mount('a.0.b', echo);

        const input = { a: [{ b: 1 }] };
        const output = await container.run(input);

        expect(Array.isArray((output as any).a)).toBe(true);
        expect(JSON.parse(JSON.stringify(output))).toEqual(input);
    });

    it('rebuilds an array around a nested container mounted at a numeric key', async () => {
        const child = new Container();
        child.mount('name', echo);

        const container = new Container();
        container.mount('items.0', child);

        const input = { items: [{ name: 'x' }] };
        const output = await container.run(input);

        expect(Array.isArray((output as any).items)).toBe(true);
        expect(JSON.parse(JSON.stringify(output))).toEqual(input);
    });

    it('rebuilds a deeply mixed array/object path', async () => {
        const container = new Container();
        container.mount('a.0.b.1.c', echo);

        const output = await container.run({ a: [{ b: [{ c: 'skip' }, { c: 'deep' }] }] });

        // Only the mounted path is carried into the output, so `b[0]` stays a
        // hole and serializes as null. What matters here is that both levels
        // are arrays rather than numeric-keyed objects.
        expect(JSON.parse(JSON.stringify(output)))
            .toEqual({ a: [{ b: [null, { c: 'deep' }] }] });
    });

    it('still nests plain object paths', async () => {
        const container = new Container();
        container.mount('foo.bar.baz', echo);

        const input = { foo: { bar: { baz: 1 } } };
        const output = await container.run(input);

        expect(Array.isArray((output as any).foo)).toBe(false);
        expect(JSON.parse(JSON.stringify(output))).toEqual(input);
    });

    it('leaves the dotted keys alone under flat: true', async () => {
        const container = new Container();
        container.mount('items.*.name', echo);

        const output = await container.run(
            { items: [{ name: 'alpha' }] },
            { flat: true },
        );

        // Expanded keys keep pathtrace's bracket notation for indices; this
        // branch never reaches `setPathValue`, which is exactly why the
        // pre-existing glob specs could not catch the reconstruction bug.
        expect(output).toEqual({ 'items[0].name': 'alpha' });
    });

    it('survives structuredClone, not just JSON', async () => {
        // A non-index property on an array is dropped by both. Asserting only
        // JSON would leave the structured-clone path (postMessage, IndexedDB)
        // unpinned.
        const container = new Container();
        container.mount('items.*.name', echo);

        const input = { items: [{ name: 'alpha' }] };
        const output = await container.run(input);

        expect(structuredClone(output)).toEqual(input);
    });
});
