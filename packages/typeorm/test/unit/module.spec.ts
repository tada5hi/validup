/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import 'reflect-metadata';

import { DataSource } from 'typeorm';
import type { ValidationRunner } from 'validup';
import { buildErrorMessageForAttributes } from 'validup';
import { TypeormValidator } from '../../src';
import { useDataSourceOptions } from '../data/data-source';
import { Realm } from '../data/realm';
import { User } from '../data/user';

const uuidRunner : ValidationRunner = async (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value is not a string');
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ctx.value)) {
        throw new Error('Value is not a uuid');
    }

    return ctx.value;
};

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

        validator.mountRunner('name', async (ctx) => {
            if (typeof ctx.value !== 'string') {
                throw new Error('Value is not a string.');
            }

            return ctx.value;
        });

        validator.mountRunner('realm_id', uuidRunner);

        const outcome = await validator.execute({
            data: {
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

        validator.mountRunner('realm_id', uuidRunner);

        expect.assertions(2);

        try {
            await validator.execute({
                data: {
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
