/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { basic } from '@routup/basic';
import { Router, coreHandler, createNodeDispatcher } from 'routup';
import { Container, ValidupValidatorError } from 'validup';
// eslint-disable-next-line import/no-extraneous-dependencies
import supertest from 'supertest';
import { RoutupContainerAdapter } from '../../src';

const container = new Container<{ token: string }>();
container.mount('token', ({ path, value }) => {
    if (typeof value !== 'string') {
        throw new ValidupValidatorError({
            path,
        });
    }

    return value;
});

describe('src/module', () => {
    it('should validate with default', async () => {
        const router = new Router();

        router.use(basic({
            body: true,
        }));

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req);

            return output.token;
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server
            .post('/')
            .send({
                token: 'bar',
            });

        expect(response.statusCode).toEqual(200);
        expect(response.text).toEqual('bar');
    });

    it('should validate with query', async () => {
        const router = new Router();

        router.use(basic({
            query: true,
        }));

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req, {
                locations: {
                    query: true,
                },
            });

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

        router.use(basic({
            cookie: true,
        }));

        router.post('/', coreHandler(async (req) => {
            const adapter = new RoutupContainerAdapter(container);

            const output = await adapter.run(req, {
                locations: {
                    cookies: true,
                },
            });

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

            const output = await adapter.run(req, {
                locations: {
                    params: true,
                },
            });

            return output.token;
        }));

        const server = supertest(createNodeDispatcher(router));

        const response = await server
            .post('/biz');

        expect(response.statusCode).toEqual(200);
        expect(response.text).toEqual('biz');
    });
});
