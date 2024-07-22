/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSourceOptions } from 'typeorm';
import { Realm } from './realm';
import { User } from './user';

export function useDataSourceOptions() : DataSourceOptions {
    return {
        type: 'better-sqlite3',
        entities: [Realm, User],
        database: ':memory:',
        extra: {
            charset: 'UTF8_GENERAL_CI',
        },
    };
}
