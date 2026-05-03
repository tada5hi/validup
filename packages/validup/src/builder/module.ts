/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Container } from '../container';
import type {
    ContainerOptions,
    IContainer,
    MountOptions,
} from '../container/types';
import type { Validator } from '../types';
import type { Builder } from './types';

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

function isBuilder(value: unknown): value is Builder<Record<string, any>, unknown> {
    return typeof value === 'object' &&
        value !== null &&
        typeof (value as { build?: unknown }).build === 'function' &&
        typeof (value as { field?: unknown }).field === 'function';
}

class BuilderImpl<T extends Record<string, any>, C> implements Builder<T, C> {
    private readonly options: ContainerOptions<any>;

    private readonly steps: ReadonlyArray<Step<C>>;

    constructor(options: ContainerOptions<any>, steps: ReadonlyArray<Step<C>>) {
        this.options = options;
        this.steps = steps;
    }

    field<K extends string, Out>(
        key: K,
        validator: Validator<C, Out>,
        options: MountOptions = {},
    ): any {
        return new BuilderImpl<any, C>(this.options, [
            ...this.steps,
            {
                kind: 'validator',
                key,
                validator: validator as Validator<C>,
                options,
            },
        ]);
    }

    optional<K extends string, Out>(
        key: K,
        validator: Validator<C, Out>,
        options: Omit<MountOptions, 'optional'> = {},
    ): any {
        return new BuilderImpl<any, C>(this.options, [
            ...this.steps,
            {
                kind: 'validator',
                key,
                validator: validator as Validator<C>,
                options: { ...options, optional: true },
            },
        ]);
    }

    nest<K extends string, U extends Record<string, any>>(
        key: K,
        child: Builder<U, C> | IContainer<U, C>,
        options: MountOptions = {},
    ): any {
        let container: IContainer<any, C>;
        if (isBuilder(child)) {
            container = (child as Builder<U, C>).build();
        } else {
            container = child as IContainer<U, C>;
        }

        return new BuilderImpl<any, C>(this.options, [
            ...this.steps,
            {
                kind: 'nest',
                key,
                child: container,
                options,
            },
        ]);
    }

    oneOf(): Builder<T, C> {
        return new BuilderImpl<T, C>(
            { ...this.options, oneOf: true },
            this.steps,
        );
    }

    pathsToInclude(...paths: (keyof T & string)[]): Builder<T, C> {
        return new BuilderImpl<T, C>(
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

    pathsToExclude(...paths: (keyof T & string)[]): Builder<T, C> {
        return new BuilderImpl<T, C>(
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
 * starts at `{}` and grows as `.field`/`.optional`/`.nest` calls are chained;
 * `.build()` returns a `Container<T, C>` whose `run()` reflects the
 * accumulated shape.
 *
 * Pass the context type as the generic parameter to flow it through nested
 * builders and validator factories: `defineSchema<MyContext>()`.
 */
export function defineSchema<C = unknown>(): Builder<{}, C> {
    return new BuilderImpl<{}, C>({}, []);
}
