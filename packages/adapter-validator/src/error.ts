/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ValidationError } from 'express-validator/lib/base';
import { ValidupNestedError, ValidupValidatorError, buildErrorMessageForAttributes } from 'validup';

type ErrorOptions = {
    path: string,
    pathAbsolute?: string
};

function generateAttributeErrors(
    error: ValidationError,
    options: ErrorOptions,
) : ValidupValidatorError[] {
    const output : ValidupValidatorError[] = [];
    switch (error.type) {
        case 'field': {
            const name = error.path || options.path;
            const message = error.msg || buildErrorMessageForAttributes([name]);

            output.push(new ValidupValidatorError({
                path: name,
                pathAbsolute: options.pathAbsolute || options.path,
                received: error.value,
                message,
            }));
            break;
        }
        case 'alternative': {
            for (let i = 0; i < error.nestedErrors.length; i++) {
                output.push(...generateAttributeErrors(error.nestedErrors[i], options));
            }
            break;
        }
        case 'alternative_grouped': {
            for (let i = 0; i < error.nestedErrors.length; i++) {
                for (let j = 0; j < error.nestedErrors[i].length; j++) {
                    output.push(...generateAttributeErrors(error.nestedErrors[i][j], options));
                }
            }
        }
    }

    return output;
}

export function buildNestedError(
    errors: ValidationError[],
    options: ErrorOptions,
): ValidupNestedError {
    const base = new ValidupNestedError();
    const names : (number | string)[] = [];
    for (let i = 0; i < errors.length; i++) {
        const children = generateAttributeErrors(errors[i], options);
        for (let j = 0; j < children.length; j++) {
            base.addChild(children[j]);
            names.push(children[j].path);
        }
    }

    base.message = buildErrorMessageForAttributes(names);

    return base;
}
