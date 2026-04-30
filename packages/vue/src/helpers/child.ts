/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { InjectionKey, Ref } from 'vue';
import type { ObjectLiteral } from 'validup';
import type { ParentRegistry, ValidupComposable } from '../types';

export const PARENT_INJECTION_KEY: InjectionKey<ParentRegistry> = Symbol.for('validup:parent');

export function extractValidupResultsFromChild<T extends ObjectLiteral = ObjectLiteral>(
    composable: ValidupComposable<any> | Ref<ValidupComposable<any>>,
    name: string,
): Partial<T> {
    const $v = 'value' in composable ? composable.value : composable;
    const child = $v.$getResultsForChild<T>(name);
    if (!child) {
        return {};
    }

    const output: Partial<T> = {};
    const fields = child.fields as Record<string, { $model: { value: unknown } }>;
    for (const key of Object.keys(fields)) {
        (output as Record<string, unknown>)[key] = fields[key].$model.value;
    }
    return output;
}
