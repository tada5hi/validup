/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { expect } from 'vitest';
import type { Container, ContainerInput, ContainerRunOptions } from '../../src';
import { isValidupError } from '../../src';

/**
 * Assert the sync/async twin contract at the `Container` boundary: `run` and
 * `runSync` are driven from one shared body (`Container.runBody`), so for any
 * synchronous validator graph they must produce identical output — and, on
 * failure, identical issue trees.
 *
 * Returns the async result so a caller can make further assertions on it.
 */
export async function expectRunParity<T extends Record<string, any>, C>(
    container: Container<T, C>,
    input?: ContainerInput<T>,
    options?: ContainerRunOptions<T, C>,
): Promise<T> {
    const result = await container.run(input, options);
    const resultSync = container.runSync(input, options);

    expect(resultSync).toEqual(result);

    return result;
}

/**
 * Failure counterpart of {@link expectRunParity}: both variants must reject /
 * throw, and the resulting `ValidupError.issues` trees must be deeply equal.
 *
 * Returns the async variant's issues for further assertions.
 */
export async function expectRunFailureParity<T extends Record<string, any>, C>(
    container: Container<T, C>,
    input?: ContainerInput<T>,
    options?: ContainerRunOptions<T, C>,
): Promise<unknown[]> {
    const async = await container.safeRun(input, options);
    const sync = container.safeRunSync(input, options);

    expect(async.success).toEqual(false);
    expect(sync.success).toEqual(false);

    if (async.success || sync.success) {
        throw new Error('expected both run variants to fail');
    }

    expect(isValidupError(async.error)).toEqual(true);
    expect(sync.error.issues).toEqual(async.error.issues);

    return async.error.issues;
}
