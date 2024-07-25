/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, EntityTarget } from 'typeorm';
import type { ContainerOptions } from 'validup';

export type TypeormContainerContext<T> = {
    dataSource: DataSource,
    entityTarget: EntityTarget<T>,
    options?: ContainerOptions<T>
};
