/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export interface Issue {
    /**
     * Code identifying the issue
     */
    code?: string,

    /**
     * Context in which the issue occurred.
     */
    meta?: Record<string, unknown>,

    /**
     * Received input value.
     */
    received?: unknown,

    /**
     * Expected input value.
     */
    expected?: unknown,

    /**
     * Issue path.
     */
    path: PropertyKey[],

    /**
     * Issue message.
     */
    message: string
}
