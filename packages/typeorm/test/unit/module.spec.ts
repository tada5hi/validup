/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { buildErrorMessageForAttributes } from 'validup';
import { TypeormValidator } from '../../src';
import { useDataSourceOptions } from '../data/data-source';
import { Realm } from '../data/realm';
import { User } from '../data/user';

describe('src/module', () => {
    const dataSource = new DataSource(useDataSourceOptions());
    let realm : Realm;

    beforeAll(async () => {
        await dataSource.initialize();
        await dataSource.synchronize();

        const userRepository = dataSource.getRepository(Realm);
        realm = await userRepository.save({
            name: 'MASTER',
        });
    });

    it('should validate', async () => {
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

    it('should not validate', async () => {
        const validator = new TypeormValidator(dataSource, User);

        validator.register(validator.createChain('realm_id').isUUID());

        expect.assertions(2);

        try {
            await validator.execute({
                body: {
                    realm_id: '926bc2dc-f448-4441-a76e-7e6c6ff58204',
                },
            });
        } catch (e) {
            expect(e).toBeDefined();
            expect((e as Error).message).toEqual(buildErrorMessageForAttributes(['realm_id']));
        }
    });

    it('should get internal entity columns', async () => {
        const validator = new TypeormValidator(dataSource, User);

        const attributes = await validator.getEntityColumns();
        expect(attributes).toEqual(['id', 'name', 'realm_id', 'realm']);
    });
});
