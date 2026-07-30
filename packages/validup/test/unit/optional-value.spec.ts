/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { OptionalValue, isOptionalValue } from '../../src';

/**
 * `isOptionalValue` is the atom matcher the three run loops consult via
 * `Container.resolveOptionalDirective`. Asserted here at its own edge —
 * `optional.spec.ts` covers how the container *uses* it.
 */
describe('isOptionalValue', () => {
    const values: Record<string, unknown> = {
        undefined,
        null: null,
        emptyString: '',
        zero: 0,
        false: false,
        nan: Number.NaN,
        string: 'x',
        one: 1,
        true: true,
        object: {},
    };

    const table: [`${OptionalValue}`, string[]][] = [
        [OptionalValue.UNDEFINED, ['undefined']],
        [OptionalValue.NULL, ['null']],
        [OptionalValue.EMPTY_STRING, ['emptyString']],
        [OptionalValue.ZERO, ['zero']],
        [OptionalValue.FALSE, ['false']],
        [OptionalValue.NAN, ['nan']],
        [OptionalValue.FALSY, ['undefined', 'null', 'emptyString', 'zero', 'false', 'nan']],
    ];

    for (const [atom, matching] of table) {
        describe(`'${atom}'`, () => {
            const keys = Object.keys(values);
            for (const key of keys) {
                const expected = matching.includes(key);
                it(`should ${expected ? 'match' : 'not match'} ${key}`, () => {
                    expect(isOptionalValue(values[key], atom)).toEqual(expected);
                });
            }
        });
    }

    it('should default to UNDEFINED when no definition is supplied', () => {
        expect(isOptionalValue(undefined)).toEqual(true);
        expect(isOptionalValue(null)).toEqual(false);
        expect(isOptionalValue('')).toEqual(false);
        expect(isOptionalValue(0)).toEqual(false);
    });

    it('should not widen NULL to include undefined', () => {
        expect(isOptionalValue(undefined, OptionalValue.NULL)).toEqual(false);
    });

    it('should treat the array form as any-of', () => {
        const definition = [OptionalValue.NULL, OptionalValue.EMPTY_STRING];

        expect(isOptionalValue(null, definition)).toEqual(true);
        expect(isOptionalValue('', definition)).toEqual(true);
        expect(isOptionalValue(undefined, definition)).toEqual(false);
        expect(isOptionalValue(0, definition)).toEqual(false);
    });

    it('should never match for an empty array', () => {
        expect(isOptionalValue(undefined, [])).toEqual(false);
        expect(isOptionalValue(null, [])).toEqual(false);
    });

    it('should tolerate FALSY mixed with atoms', () => {
        const definition = [OptionalValue.FALSY, OptionalValue.NULL];

        expect(isOptionalValue(0, definition)).toEqual(true);
        expect(isOptionalValue(null, definition)).toEqual(true);
        expect(isOptionalValue('x', definition)).toEqual(false);
    });

    it('should not match an unknown atom', () => {
        expect(isOptionalValue(undefined, 'bogus' as any)).toEqual(false);
    });

    it('should only match NaN for numeric NaN', () => {
        expect(isOptionalValue(Number.NaN, OptionalValue.NAN)).toEqual(true);
        // `Number.isNaN('x')` is false, but a naive `isNaN('x')` would be true.
        expect(isOptionalValue('x', OptionalValue.NAN)).toEqual(false);
    });
});
