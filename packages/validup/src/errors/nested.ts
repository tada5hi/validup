/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidupValidatorError } from './attribute';
import { ValidupError } from './base';

export class ValidupNestedError extends ValidupError {
    children: ValidupValidatorError[];

    constructor(message?: string, children?: ValidupValidatorError[]) {
        super(message);

        this.children = children || [];
    }

    addChild(child: ValidupValidatorError) {
        this.children.push(child);
    }
}
