/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { resolveDefaults } from '../../src';

/**
 * `resolveDefaults` slices a parent `defaults` map for one nested container
 * mount. Consulted by the run loops through
 * `Container.buildChildRunOptions`; asserted here at its own edge.
 */
describe('resolveDefaults', () => {
    it('should return undefined when no defaults are supplied', () => {
        expect(resolveDefaults(undefined, 'address')).toBeUndefined();
    });

    it('should forward the whole map for a keyless mount', () => {
        const defaults = { 'a.b': 1, c: 2 };
        expect(resolveDefaults(defaults, '')).toEqual(defaults);
    });

    it('should strip the mount prefix from matching entries', () => {
        expect(resolveDefaults({ 'address.zip': '10115', name: 'Peter' }, 'address'))
            .toEqual({ zip: '10115' });
    });

    it('should keep deeper paths intact below the stripped prefix', () => {
        expect(resolveDefaults({ 'address.geo.lat': 52 }, 'address'))
            .toEqual({ 'geo.lat': 52 });
    });

    it('should skip an exact-key match — the parent fills that in post-loop', () => {
        expect(resolveDefaults({ address: {} }, 'address')).toBeUndefined();
    });

    it('should return undefined when nothing targets the mount', () => {
        expect(resolveDefaults({ name: 'Peter' }, 'address')).toBeUndefined();
    });

    it('should not treat a shared name prefix as a match', () => {
        expect(resolveDefaults({ 'addressLine.zip': 1 }, 'address')).toBeUndefined();
    });

    it('should preserve an undefined default value while reporting a match', () => {
        expect(resolveDefaults({ 'address.zip': undefined }, 'address'))
            .toEqual({ zip: undefined });
    });
});
