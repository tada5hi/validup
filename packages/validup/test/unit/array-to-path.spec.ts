/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { arrayToPropertyPath } from '../../src';

describe('array-to-path', () => {
    it.each([
        ['single text segment', ['foo'], 'foo'],
        ['multiple text segments', ['foo', 'bar', 'baz'], 'foo.bar.baz'],
        ['trailing numeric segment', ['foo', '0'], 'foo[0]'],
        ['numeric segment between text segments', ['foo', '0', 'bar'], 'foo[0].bar'],
        ['numeric segment followed by numeric segment', ['foo', '0', '0'], 'foo[0][0]'],
        ['text segment with a dot', ['foo', '.bar'], 'foo[".bar"]'],
    ])('%s', (_name, input, expected) => {
        expect(arrayToPropertyPath(input)).toBe(expected);
    });
});
