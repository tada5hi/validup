/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { z } from 'zod';
import { Validator } from 'validup';
import { createRunner } from '../../src';

describe('src/module', () => {
    it('should work with zod validation', async () => {
        const validator = new Validator<{ email: string }>();

        validator.mountRunner('email', createRunner(z.string().email()));

        const outcome = await validator.run({
            data: {
                email: 'foo@example.com',
            },
        });

        expect(outcome).toBeDefined();
        expect(outcome.email).toEqual('foo@example.com');
    });
});
