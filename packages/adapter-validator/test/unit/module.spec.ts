/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container, ValidupError } from 'validup';
import { createValidationChain, createValidator } from '../../src';
import { UserValidator } from '../data/user';

describe('src/module', () => {
    it('should validate extended validator', async () => {
        const validator = new UserValidator();

        const outcome = await validator.run({
            name: 'Peter',
            age: 28,
            password: '1234',
            foo: 'bar',
        });

        expect(outcome).toBeDefined();
        expect(outcome.name).toEqual('Peter');
        expect(outcome.age).toEqual(28);
        expect(outcome.password).toEqual('1234');
        expect((outcome as Record<string, any>).foo).toBeUndefined();
    });

    it('should validate', async () => {
        const validator = new Container();
        validator.mount(
            'foo',
            createValidator(() => {
                const chain = createValidationChain();

                return chain.isArray({ min: 1, max: 10 });
            }),
        );

        const outcome = await validator.run({
            foo: [1],
        });

        expect(outcome.foo).toEqual([1]);
    });

    it('should behave differently depending on group', async () => {
        const validator = createValidator((ctx) => {
            const chain = createValidationChain()
                .isArray({ min: 1, max: 10 });

            if (ctx.group === 'optional') {
                return chain.optional({ values: 'null' });
            }

            return chain;
        });

        const container = new Container();
        container.mount('foo', { group: 'required' }, validator);
        container.mount('foo', { group: 'optional' }, validator);

        expect.assertions(2);

        const outcome = await container.run({
            foo: null,
        }, {
            group: 'optional',
        });

        expect(outcome.foo).toEqual(null);

        try {
            await container.run({
                foo: null,
            }, {
                group: 'required',
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('should not validate', async () => {
        expect.assertions(3);

        const validator = new Container();
        validator.mount('foo', createValidator(() => {
            const chain = createValidationChain();
            return chain.isArray({ min: 1, max: 10 });
        }));

        try {
            await validator.run({
                foo: [],
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                expect(e.issues).toBeDefined();
                expect(e.issues).toHaveLength(1);
                expect(e.issues[0].path).toEqual(['foo']);
            }
        }
    });

    it('should not validate nested container', async () => {
        expect.assertions(3);

        const child = new Container();
        child.mount('foo', createValidator(() => {
            const chain = createValidationChain();

            return chain.isArray({ min: 1, max: 10 });
        }));

        const parent = new Container();
        parent.mount('child', child);

        try {
            await parent.run({
                child: {
                    foo: [],
                },
            });
        } catch (e) {
            if (e instanceof ValidupError) {
                const [issue] = e.issues;
                expect(issue.path).toEqual(['child']);

                if (issue.type === 'group') {
                    expect(issue.issues).toHaveLength(1);
                    expect(issue.issues[0].path).toEqual(['child', 'foo']);
                }
            }
        }
    });
});
