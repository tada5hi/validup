/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';
import type { IContainer } from './types';

export function isContainer(input: unknown) : input is IContainer {
    return isObject(input) &&
        typeof input.run === 'function';
}
