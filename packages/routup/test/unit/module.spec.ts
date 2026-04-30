/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { basic } from '@routup/basic';
import { Router, coreHandler, createNodeDispatcher } from 'routup';
import { Container, ValidupError } from 'validup';
import supertest from 'supertest';
import { RoutupContainerAdapter } from '../../src';

const container = new Container<{ token: string }>();
container.mount('token', ({ value }) => {
    if (typeof value !== 'string') {
        throw new ValidupError();
    }

    return value;
});

describe('src/module', () => {
    it('should validate with default', async () => {
        const router = new Router();

        router.use(basic({ body: true }));

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req);

            return output.token;
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server
            .post('/')
            .send({ token: 'bar' });

        expect(response.statusCode).toEqual(200);
        expect(response.text).toEqual('bar');
    });

    it('should validate with query', async () => {
        const router = new Router();

        router.use(basic({ query: true }));

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req, { locations: ['query'] });

            return output.token;
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server
            .post('/?token=baz');

        expect(response.statusCode).toEqual(200);
        expect(response.text).toEqual('baz');
    });

    it('should validate with cookies', async () => {
        const router = new Router();

        router.use(basic({ cookie: true }));

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req, { locations: ['cookies'] });

            return output.token;
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server
            .post('/')
            .set('Cookie', [
                'token=boz',
            ]);

        expect(response.statusCode).toEqual(200);
        expect(response.text).toEqual('boz');
    });

    it('should validate with params', async () => {
        const router = new Router();

        router.post('/:token', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req, { locations: ['params'] });

            return output.token;
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server
            .post('/biz');

        expect(response.statusCode).toEqual(200);
        expect(response.text).toEqual('biz');
    });

    it('should not mutate caller-supplied locations array', async () => {
        const router = new Router();

        router.use(basic({ body: true }));

        const locations: ('body' | 'cookies' | 'params' | 'query')[] = [];

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);
            await adapter.run(req, { locations });
            return 'ok';
        }));

        const server = supertest(createNodeDispatcher(router));

        await server.post('/').send({ token: 'bar' });

        expect(locations).toEqual([]);
    });

    it('should treat a duck-typed ValidupError from a foreign realm as a ValidupError', async () => {
        const router = new Router();

        router.use(basic({ body: true }));

        // Simulate a `validup` instance from a different package copy: a plain
        // Error carrying an `issues` array that satisfies `isValidupError`'s
        // duck-typed shape but is *not* `instanceof ValidupError`.
        const foreignContainer = {
            run: async () => {
                const err: any = new Error('foreign');
                err.issues = [{
                    type: 'item',
                    code: 'value_invalid',
                    path: ['token'],
                    message: 'foreign issue',
                }];
                throw err;
            },
            safeRun: async () => ({ success: false as const, error: new ValidupError() }),
        };

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(foreignContainer as any);
            try {
                await adapter.run(req);
                return 'ok';
            } catch (e: any) {
                return e.issues?.[0]?.message ?? 'unknown';
            }
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server.post('/').send({ token: 1 });

        expect(response.text).toEqual('foreign issue');
    });
});
