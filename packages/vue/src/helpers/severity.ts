/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldState, Severity } from '../types';

export function getSeverity(state: FieldState<any>): Severity {
    if (!state.$dirty.value) {
        return undefined;
    }
    if (state.$pending.value) {
        return 'warning';
    }
    if (state.$invalid.value) {
        return 'error';
    }
    return 'success';
}
