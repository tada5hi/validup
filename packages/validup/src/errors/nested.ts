/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidupValidatorError } from './validator';
import { ValidupError } from './base';

export type ValidupNestedErrorOptions = {
    children?: ValidupValidatorError[],
    message?: string
};

export class ValidupNestedError extends ValidupError {
    children: ValidupValidatorError[];

    constructor(options: ValidupNestedErrorOptions = {}) {
        super(options.message || 'One or many attributes may be invalid.');

        this.children = options.children || [];
    }

    addChild(child: ValidupValidatorError) {
        this.children.push(child);
    }
}
