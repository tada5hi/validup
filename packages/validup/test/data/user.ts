/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Validator } from '../../src';

export type User = {
    name: string,
    age: number,
    password: string,
    token: string
};

export class UserValidator extends Validator<User> {
    constructor() {
        super();

        const name = this.createChain('name')
            .exists()
            .notEmpty()
            .isLength({ min: 3, max: 128 });

        const age = this.createChain('age')
            .isNumeric()
            .optional({ values: 'null' });

        const oneOf = this.createOneOf([
            this.createChain('password')
                .isLength({ min: 3, max: 128 }),
            this.createChain('token')
                .isLength({ min: 3, max: 128 }),
        ]);

        this.registerMany([
            name,
            age,
            oneOf,
        ]);
    }
}
