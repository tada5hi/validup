/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidationError } from 'express-validator/lib/base';
import { ValidationAttributeError, ValidationNestedError, buildErrorMessageForAttributes } from 'validup';

function generateAttributeErrors(
    error: ValidationError,
) : ValidationAttributeError[] {
    const output : ValidationAttributeError[] = [];
    switch (error.type) {
        case 'field': {
            output.push(new ValidationAttributeError({
                path: [error.path],
                received: error.value,
            }));
            break;
        }
        case 'alternative': {
            for (let i = 0; i < error.nestedErrors.length; i++) {
                output.push(...generateAttributeErrors(error.nestedErrors[i]));
            }
            break;
        }
        case 'alternative_grouped': {
            for (let i = 0; i < error.nestedErrors.length; i++) {
                for (let j = 0; j < error.nestedErrors[i].length; j++) {
                    output.push(...generateAttributeErrors(error.nestedErrors[i][j]));
                }
            }
        }
    }

    return output;
}

export function buildError(errors: ValidationError[]): ValidationNestedError {
    const base = new ValidationNestedError();
    const names : (number | string)[] = [];
    for (let i = 0; i < errors.length; i++) {
        const children = generateAttributeErrors(errors[i]);
        for (let j = 0; j < children.length; j++) {
            base.addChild(children[j]);
            names.push(...children[j].path);
        }
    }

    base.message = buildErrorMessageForAttributes(names);

    return base;
}
