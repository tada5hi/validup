/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Validator } from '../../src';

const stringValidator : Validator = async (ctx) : Promise<unknown> => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }

    return ctx.value;
};

export {
    stringValidator,
};
