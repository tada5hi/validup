/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Validator } from 'validup';
import { createRunner } from '../../src';

export type User = {
    name: string,
    age: number,
    password: string,
    token: string
};

export class UserValidator extends Validator<User> {
    constructor() {
        super();

        this.mount('name', createRunner((chain) => chain.exists()
            .notEmpty()
            .isLength({ min: 3, max: 128 })));

        this.mount('age', createRunner((chain) => chain.isNumeric()
            .optional({ values: 'null' })));

        this.mount('password', createRunner((chain) => chain
            .isLength({ min: 3, max: 128 })));
    }
}
