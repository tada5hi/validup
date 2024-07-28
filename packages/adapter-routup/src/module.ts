/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { useRequestParams } from 'routup';
import type { Request } from 'routup';
import { useRequestBody } from '@routup/basic/body';
import { useRequestCookies } from '@routup/basic/cookie';
import { useRequestQuery } from '@routup/basic/query';
import type { Container, ObjectLiteral } from 'validup';
import { Location } from './constants';
import type { RoutupContainerRunOptions } from './types';

export class RoutupContainerAdapter<T extends ObjectLiteral = ObjectLiteral> {
    protected container : Container<T>;

    constructor(container: Container<T>) {
        this.container = container;
    }

    async run(req: Request, options: RoutupContainerRunOptions<T> = {}) : Promise<T> {
        const locations = options.locations || [];
        if (locations.length === 0) {
            locations.push(Location.BODY);
        }

        let output = {} as T;

        for (let i = 0; i < locations.length; i++) {
            let data : Record<string, any>;

            switch (locations[i]) {
                case Location.COOKIES: {
                    data = useRequestCookies(req);
                    break;
                }
                case Location.QUERY: {
                    data = useRequestQuery(req);
                    break;
                }
                case Location.PARAMS: {
                    data = useRequestParams(req);
                    break;
                }
                default: {
                    data = useRequestBody(req);
                    break;
                }
            }

            try {
                output = await this.container.run(data, options);
                break;
            } catch (e) {
                // do nothing...
            }
        }

        return output as T;
    }
}
