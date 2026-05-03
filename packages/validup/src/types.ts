/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ObjectLiteral = Record<string | number, any>;

export type ValidatorContext<C = unknown> = {
    /**
     * The expanded mount path in the current container.
     */
    key: string,

    /**
     * The global mount path of the parent container.
     */
    path: PropertyKey[],

    /**
     * The actual value, which should be validated.
     */
    value: unknown,

    /**
     * The input data of the current container.
     */
    data: Record<string, any>,

    /**
     * The group name for which the validator is executed.
     */
    group?: string,

    /**
     * Caller-supplied context, forwarded unchanged through nested containers.
     * Useful for request-scoped data (current user, locale, DB connection,
     * request id) that validators need but isn't part of the validated value.
     */
    context: C,

    /**
     * Cancellation signal forwarded from `ContainerRunOptions.signal`.
     * Async validators (DB lookups, HTTP fetches) should pass it through to
     * cancel I/O when the run is aborted. The container itself checks
     * `signal.aborted` between mounts and rethrows the signal's `reason`.
     */
    signal?: AbortSignal
};

export type Validator<C = unknown> = (ctx: ValidatorContext<C>) => Promise<unknown> | unknown;
