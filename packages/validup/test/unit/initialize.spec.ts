/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from '../../src';
import { stringValidator } from '../data';

class StringContainer extends Container {
    protected override initialize() {
        super.initialize();

        this.mount('foo', stringValidator);
    }
}

describe('src/module/initialize', () => {
    it('should call initialize method', async () => {
        const container = new StringContainer();

        const output = await container.run({
            foo: 'bar',
        });

        expect(output.foo).toEqual('bar');
    });
});
