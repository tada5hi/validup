/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { TypeormValidator } from '../../src';
import { useDataSourceOptions } from '../data/data-source';
import { Realm } from '../data/realm';
import { User } from '../data/user';

describe('src/module', () => {
    it('should validate', async () => {
        const dataSource = new DataSource(useDataSourceOptions());
        await dataSource.initialize();
        await dataSource.synchronize();

        const userRepository = dataSource.getRepository(Realm);
        const realm = await userRepository.save({
            name: 'MASTER',
        });

        const validator = new TypeormValidator(dataSource, User);

        validator.register(validator.createChain('name').isString());
        validator.register(validator.createChain('realm_id').isUUID());

        const outcome = await validator.execute({
            body: {
                name: 'admin',
                realm_id: realm.id,
            },
        });
        expect(outcome).toBeDefined();
        expect(outcome.name).toEqual('admin');
        expect(outcome.realm_id).toEqual(realm.id);
    });
});
