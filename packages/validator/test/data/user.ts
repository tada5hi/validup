/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from 'validup';
import { createValidator } from '../../src';

export type User = {
    name: string,
    age: number,
    password: string,
    token: string
};

export class UserValidator extends Container<User> {
    constructor() {
        super();

        this.mount('name', createValidator((chain) => chain.exists()
            .notEmpty()
            .isLength({ min: 3, max: 128 })));

        this.mount('age', createValidator((chain) => chain.isNumeric()
            .optional({ values: 'null' })));

        this.mount('password', createValidator((chain) => chain
            .isLength({ min: 3, max: 128 })));
    }
}
