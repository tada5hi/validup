/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ContainerRunOptions, ObjectLiteral } from 'validup';
import type { Location } from './constants';

export type Input<T extends ObjectLiteral> = {
    [Key in `${Location}`]: T
};
export type RoutupContainerRunOptions<T extends ObjectLiteral> = ContainerRunOptions<T> & {
    /**
     * default: ['body']
     */
    locations?: `${Location}`[]
};
