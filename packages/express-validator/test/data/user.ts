/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from 'validup';
import { createValidationChain, createValidator } from '../../src';

export type User = {
    name: string,
    age: number,
    password: string,
    token: string
};

export class UserValidator extends Container<User> {
    constructor() {
        super();

        this.mount('name', createValidator(() => {
            const chain = createValidationChain();
            return chain.exists()
                .notEmpty()
                .isLength({ min: 3, max: 128 });
        }));

        this.mount('age', createValidator(() => {
            const chain = createValidationChain();

            return chain.isNumeric()
                .optional({ values: 'null' });
        }));

        this.mount('password', createValidator(() => {
            const chain = createValidationChain();
            return chain
                .isLength({ min: 3, max: 128 });
        }));
    }
}
