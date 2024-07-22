/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    DataSource, EntityMetadata, EntityTarget, FindOptionsWhere, ObjectLiteral,
} from 'typeorm';
import type { ContainerRunOptions } from 'validup';
import { Container, ValidupNestedError, buildErrorMessageForAttributes } from 'validup';

export class TypeormValidator<
    T extends Record<string, any> = Record<string, any>,
> extends Container<T> {
    protected dataSource : DataSource;

    protected entityTarget : EntityTarget<T>;

    constructor(
        dataSource: DataSource,
        entityTarget: EntityTarget<T>,
    ) {
        super();

        this.dataSource = dataSource;
        this.entityTarget = entityTarget;
    }

    override async run(
        data: Record<string, any>,
        options: ContainerRunOptions<T> = {},
    ): Promise<T> {
        const result = await super.run(data, options);

        const relations = await this.validateEntityRelations(result);
        const relationKeys = Object.keys(relations);
        for (let i = 0; i < relationKeys.length; i++) {
            const relationKey = relationKeys[i];

            result[relationKey as keyof T] = relations[relationKey] as T[keyof T];
        }

        return result;
    }

    protected async validateEntityRelations(input: Partial<T>) : Promise<Partial<T>> {
        const entityMetadata = await this.getEntityMetadata();

        const output : Record<string, any> = {};
        for (let i = 0; i < entityMetadata.relations.length; i++) {
            const relation = entityMetadata.relations[i];

            const where : FindOptionsWhere<ObjectLiteral> = {};
            const columns : string[] = [];
            for (let j = 0; j < relation.joinColumns.length; j++) {
                const joinColumn = relation.joinColumns[j];
                if (typeof input[joinColumn.propertyName] === 'undefined') {
                    continue;
                }

                if (joinColumn.referencedColumn) {
                    where[joinColumn.referencedColumn.propertyName] = input[joinColumn.propertyName];
                    columns.push(joinColumn.propertyName);
                } else {
                    throw new ValidupNestedError(`Can not lookup foreign ${relation.propertyName} entity.`);
                }
            }

            if (columns.length === 0) {
                continue;
            }

            const repository = this.dataSource.getRepository(relation.type);
            const entity = await repository.findOne({
                where,
            });

            if (!entity) {
                throw new ValidupNestedError(buildErrorMessageForAttributes(columns));
            }

            output[relation.propertyName] = entity;
        }

        return output as Partial<T>;
    }

    async getEntityColumns() {
        const entityMetadata = await this.getEntityMetadata();

        const items : string[] = [];

        for (let i = 0; i < entityMetadata.columns.length; i++) {
            items.push(entityMetadata.columns[i].propertyName);
        }

        for (let i = 0; i < entityMetadata.relations.length; i++) {
            items.push(entityMetadata.relations[i].propertyName);
        }

        return items;
    }

    protected async getEntityMetadata() : Promise<EntityMetadata> {
        const index = this.dataSource.entityMetadatas.findIndex(
            (entityMetadata) => entityMetadata.target === this.entityTarget,
        );

        if (index === -1) {
            throw new ValidupNestedError(`The entity ${this.entityTarget} is not registered.`);
        }

        return this.dataSource.entityMetadatas[index];
    }
}