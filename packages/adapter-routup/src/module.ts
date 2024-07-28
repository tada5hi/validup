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
import type { ObjectLiteral } from 'validup';
import { Container, isObject } from 'validup';
import { Location } from './constants';
import type { Input, RoutupContainerRunOptions } from './types';

export class RoutupContainerAdapter<T extends ObjectLiteral = ObjectLiteral> {
    protected container : Container<T>;

    constructor(container: Container<T>) {
        this.container = container;
    }

    async run(req: Request, options: RoutupContainerRunOptions<Input<T>> = {}) : Promise<T> {
        const wrapper = new Container<Input<T>>({
            oneOf: true,
        });

        const locations = options.locations || {};

        const data : Record<string, any> = {};

        if (typeof locations.body === 'undefined' || locations.body) {
            data.body = useRequestBody(req);
            wrapper.mount(Location.BODY, { group: options.group }, this.container);
        }

        if (locations.query) {
            data.query = useRequestQuery(req);
            wrapper.mount(Location.QUERY, { group: options.group }, this.container);
        }

        if (locations.params) {
            data.params = useRequestParams(req);
            wrapper.mount(Location.PARAMS, { group: options.group }, this.container);
        }

        if (locations.cookies) {
            data.cookies = useRequestCookies(req);
            wrapper.mount(Location.COOKIES, { group: options.group }, this.container);
        }

        const output : Record<string, any> = {};

        // todo: extend defaults, pathsToInclude
        const tmp = await wrapper.run(data, options);
        const tmpKeys = Object.keys(tmp);
        for (let i = 0; i < tmpKeys.length; i++) {
            const tmpKey = tmpKeys[i];
            const tmpValue = tmp[tmpKey as keyof typeof tmp];

            if (isObject(tmpValue)) {
                this.extendObjectProperties(output, tmpValue);
            }
        }

        return output as T;
    }

    private extendObjectProperties<O extends Record<string, any>>(
        src: O,
        input: Partial<O>,
    ) : O {
        const keys : (keyof O)[] = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            src[keys[i]] = input[keys[i]] as O[keyof O];
        }

        return src;
    }
}
