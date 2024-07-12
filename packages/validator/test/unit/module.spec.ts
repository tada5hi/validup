/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { UserValidator } from '../data/user';

describe('src/module', () => {
    it('should validate extended validator', async () => {
        const validator = new UserValidator();

        const outcome = await validator.execute({
            data: {
                name: 'Peter',
                age: 28,
                password: '1234',
                foo: 'bar',
            },
        });

        expect(outcome).toBeDefined();
        expect(outcome.name).toEqual('Peter');
        expect(outcome.age).toEqual(28);
        expect(outcome.password).toEqual('1234');
        expect((outcome as Record<string, any>).foo).toBeUndefined();
    });
});
