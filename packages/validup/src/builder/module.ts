/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container, isContainer } from '../container';
import type {
    ContainerOptions,
    IContainer,
    MountOptions,
} from '../container/types';
import type { Validator } from '../types';
import type { IBuilder, MountTarget } from './types';

type ValidatorStep<C> = {
    kind: 'validator',
    key: string,
    validator: Validator<C>,
    options: MountOptions,
};

type NestStep<C> = {
    kind: 'nest',
    key: string,
    child: IContainer<any, C>,
    options: MountOptions,
};

type Step<C> = ValidatorStep<C> | NestStep<C>;

function isBuilder(value: unknown): value is IBuilder<Record<string, any>, unknown> {
    return typeof value === 'object' &&
        value !== null &&
        typeof (value as { build?: unknown }).build === 'function' &&
        typeof (value as { mount?: unknown }).mount === 'function';
}

export class Builder<T extends Record<string, any>, C> implements IBuilder<T, C> {
    private readonly options: ContainerOptions<any>;

    private readonly steps: ReadonlyArray<Step<C>>;

    constructor(options: ContainerOptions<any>, steps: ReadonlyArray<Step<C>>) {
        this.options = options;
        this.steps = steps;
    }

    mount(key: string, ...rest: unknown[]): any {
        let options: MountOptions = {};
        let target: MountTarget<C>;

        if (rest.length === 1) {
            target = rest[0] as MountTarget<C>;
        } else {
            options = rest[0] as MountOptions;
            target = rest[1] as MountTarget<C>;
        }

        let step: Step<C>;
        if (isBuilder(target)) {
            step = {
                kind: 'nest',
                key,
                child: (target as IBuilder<any, C>).build(),
                options,
            };
        } else if (isContainer(target)) {
            step = {
                kind: 'nest',
                key,
                child: target as IContainer<any, C>,
                options,
            };
        } else {
            step = {
                kind: 'validator',
                key,
                validator: target as Validator<C>,
                options,
            };
        }

        return new Builder<any, C>(this.options, [...this.steps, step]);
    }

    oneOf(): IBuilder<T, C> {
        return new Builder<T, C>(
            { ...this.options, oneOf: true },
            this.steps,
        );
    }

    pathsToInclude(...paths: (keyof T & string)[]): IBuilder<T, C> {
        return new Builder<T, C>(
            {
                ...this.options,
                pathsToInclude: [
                    ...((this.options.pathsToInclude as string[]) ?? []),
                    ...paths,
                ] as ContainerOptions<any>['pathsToInclude'],
            },
            this.steps,
        );
    }

    pathsToExclude(...paths: (keyof T & string)[]): IBuilder<T, C> {
        return new Builder<T, C>(
            {
                ...this.options,
                pathsToExclude: [
                    ...((this.options.pathsToExclude as string[]) ?? []),
                    ...paths,
                ] as ContainerOptions<any>['pathsToExclude'],
            },
            this.steps,
        );
    }

    build(): Container<T, C> {
        const container = new Container<T, C>(this.options as ContainerOptions<T>);
        for (const step of this.steps) {
            if (step.kind === 'nest') {
                container.mount(step.key, step.options, step.child);
            } else {
                container.mount(step.key, step.options, step.validator);
            }
        }
        return container;
    }
}

/**
 * Entry point for the compile-time-typed schema builder. The accumulator
 * starts at `{}` and grows as `.mount(...)` calls are chained;
 * `.build()` returns a `Container<T, C>` whose `run()` reflects the
 * accumulated shape.
 *
 * Pass the context type as the generic parameter to flow it through nested
 * builders and validator factories: `defineSchema<MyContext>()`.
 */
export function defineSchema<C = unknown>(): IBuilder<{}, C> {
    return new Builder<{}, C>({}, []);
}
