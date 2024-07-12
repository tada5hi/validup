/*
 * Copyright (c) 2024-2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidationAttributeError } from './attribute';
import { ValidationError } from './base';

export class ValidationNestedError extends ValidationError {
    children: ValidationAttributeError[];

    constructor(message?: string, children?: ValidationAttributeError[]) {
        super(message);

        this.children = children || [];
    }

    addChild(child: ValidationAttributeError) {
        this.children.push(child);
    }
}
