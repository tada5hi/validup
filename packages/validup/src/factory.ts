/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { CustomSanitizer, CustomValidator } from 'express-validator';
import { ExpressValidator } from 'express-validator';
import { AttributeSource } from './constants';

import type { Factory } from './types';

export function buildFactory<
VALIDATORS extends Record<string, CustomValidator> = Record<string, CustomValidator>,
SANITIZERS extends Record<string, CustomSanitizer> = Record<string, CustomSanitizer>,
>(
    validators?: VALIDATORS,
    sanitizers?: SANITIZERS,
) : Factory<VALIDATORS, SANITIZERS> {
    const instance = new ExpressValidator(validators, sanitizers);

    return {
        createCompositeChain: (
            chains,
        ) => instance.oneOf(chains, {
            errorType: 'flat',
        }),
        createChain: (
            attribute,
            source,
        ) => {
            if (source === AttributeSource.BODY) {
                return instance.body(attribute);
            }

            if (source === AttributeSource.COOKIES) {
                return instance.cookie(attribute);
            }

            if (source === AttributeSource.HEADERS) {
                return instance.header(attribute);
            }

            if (source === AttributeSource.PARAMS) {
                return instance.param(attribute);
            }

            if (source === AttributeSource.QUERY) {
                return instance.query(attribute);
            }

            return instance.check(attribute);
        },
    };
}
