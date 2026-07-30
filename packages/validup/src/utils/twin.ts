/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Internal protocol to derive parallel sync + async surfaces from **one**
 * shared body. A body is a generator that yields effect pairs — an async and
 * a sync thunk for the same operation — and the two drivers (`runTwinAsync` /
 * `runTwinSync`) execute the side they stand for. Effect errors are re-entered
 * into the body via `Generator.throw`, so `try`/`catch` around a `yield*` site
 * behaves identically in both variants.
 *
 * Bodies compose via `yield*` delegation, so a body can call another body
 * without either one knowing which side it will be driven on.
 *
 * Ported from `tada5hi/locter` (`src/utils/twin.ts`), with one deviation: the
 * async thunk may return a bare value as well as a promise. Validup's async
 * edge is a caller-supplied `Validator`, which is free to be synchronous —
 * `runTwinAsync` awaits either shape.
 *
 * Deliberately NOT exported from the utils barrel (and therefore not from
 * `src/index.ts`) — this is internal plumbing, not public API. Same treatment
 * as `container/run-sync-violation.ts`.
 */

export type TwinOp<T = unknown> = {
    async: () => T | Promise<T>,
    sync: () => T,
};

export type TwinBody<R> = Generator<TwinOp<any>, R, any>;

/**
 * Perform one effect inside a twin body: `const x = yield* op(asyncFn, syncFn)`.
 */
export function* op<T>(
    asyncFn: () => T | Promise<T>,
    syncFn: () => T,
) : Generator<TwinOp<T>, T, T> {
    return yield { async: asyncFn, sync: syncFn };
}

/**
 * Drive a twin body's async side. Each yielded op's `async` thunk is awaited;
 * a rejection is thrown back into the body at the `yield` site so in-body
 * `try`/`catch`/`finally` runs exactly as written.
 */
export async function runTwinAsync<R>(body: TwinBody<R>) : Promise<R> {
    let step = body.next();
    while (!step.done) {
        let result : unknown;
        try {
            result = await step.value.async();
        } catch (e) {
            step = body.throw(e);
            continue;
        }

        step = body.next(result);
    }

    return step.value;
}

/**
 * Drive a twin body's sync side. Mirror of {@link runTwinAsync} with the
 * `sync` thunk called directly — no microtask is introduced anywhere, which
 * is the whole point of the synchronous surface.
 */
export function runTwinSync<R>(body: TwinBody<R>) : R {
    let step = body.next();
    while (!step.done) {
        let result : unknown;
        try {
            result = step.value.sync();
        } catch (e) {
            step = body.throw(e);
            continue;
        }

        step = body.next(result);
    }

    return step.value;
}
