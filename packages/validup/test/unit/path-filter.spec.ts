/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { resolvePathFilter } from '../../src';

/**
 * `resolvePathFilter` is the include/exclude verdict the run loops consult via
 * `Container.prepareMountKey`. Asserted here at its own edge —
 * `paths-to-include.spec.ts` covers how the container *uses* it.
 */
describe('resolvePathFilter', () => {
    it('should forward filters verbatim for a keyless mount', () => {
        expect(resolvePathFilter(['a.b'], ['c'], '', true)).toEqual({
            skip: false,
            pathsToInclude: ['a.b'],
            pathsToExclude: ['c'],
        });
    });

    it('should pass through when no filter is set', () => {
        expect(resolvePathFilter(undefined, undefined, 'name', false)).toEqual({
            skip: false,
            pathsToInclude: undefined,
            pathsToExclude: undefined,
        });
    });

    describe('pathsToInclude', () => {
        it('should keep an exact match and stop forwarding', () => {
            expect(resolvePathFilter(['name'], undefined, 'name', false)).toEqual({
                skip: false,
                pathsToInclude: undefined,
                pathsToExclude: undefined,
            });
        });

        it('should skip a mount no entry targets', () => {
            expect(resolvePathFilter(['other'], undefined, 'name', false).skip).toEqual(true);
        });

        it('should descend into a container mount with the prefix stripped', () => {
            expect(resolvePathFilter(['address.city'], undefined, 'address', true)).toEqual({
                skip: false,
                pathsToInclude: ['city'],
                pathsToExclude: undefined,
            });
        });

        it('should skip a validator mount when only a deeper path is targeted', () => {
            expect(resolvePathFilter(['address.city'], undefined, 'address', false).skip).toEqual(true);
        });

        it('should prefer an exact match over a sibling prefix descent', () => {
            expect(resolvePathFilter(['address', 'address.city'], undefined, 'address', true)).toEqual({
                skip: false,
                pathsToInclude: undefined,
                pathsToExclude: undefined,
            });
        });
    });

    describe('pathsToExclude', () => {
        it('should skip an exact match', () => {
            expect(resolvePathFilter(undefined, ['name'], 'name', false).skip).toEqual(true);
        });

        it('should keep a mount no entry targets', () => {
            expect(resolvePathFilter(undefined, ['other'], 'name', false)).toEqual({
                skip: false,
                pathsToInclude: undefined,
                pathsToExclude: undefined,
            });
        });

        it('should descend into a container mount with the prefix stripped', () => {
            expect(resolvePathFilter(undefined, ['address.city'], 'address', true)).toEqual({
                skip: false,
                pathsToInclude: undefined,
                pathsToExclude: ['city'],
            });
        });

        it('should keep a validator mount when only a deeper path is excluded', () => {
            expect(resolvePathFilter(undefined, ['address.city'], 'address', false)).toEqual({
                skip: false,
                pathsToInclude: undefined,
                pathsToExclude: undefined,
            });
        });
    });

    it('should let an exclude entry win over a matching include entry', () => {
        expect(resolvePathFilter(['name'], ['name'], 'name', false).skip).toEqual(true);
    });

    it('should forward both stripped lists for a container mount', () => {
        expect(resolvePathFilter(
            ['address.city', 'address.zip'],
            ['address.zip'],
            'address',
            true,
        )).toEqual({
            skip: false,
            pathsToInclude: ['city', 'zip'],
            pathsToExclude: ['zip'],
        });
    });

    it('should not treat a shared name prefix as a descent', () => {
        // `addressLine` must not match the `address` mount.
        expect(resolvePathFilter(['addressLine'], undefined, 'address', true).skip).toEqual(true);
    });
});
