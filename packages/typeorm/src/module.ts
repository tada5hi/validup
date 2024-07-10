/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource, EntityMetadata, EntityTarget } from 'typeorm';
import type { ValidatorExecuteOptions } from 'validup';
import { ValidationError, Validator, buildErrorMessageForAttributes } from 'validup';

export class TypeormValidator<
    T extends Record<string, any> = Record<string, any>,
> extends Validator<T> {
    protected dataSource : DataSource;

    protected target : EntityTarget<T>;

    constructor(dataSource: DataSource, target: EntityTarget<T>) {
        super();

        this.dataSource = dataSource;
        this.target = target;
    }

    override async execute(
        req: Request,
        options: ValidatorExecuteOptions<T> = {},
    ): Promise<T> {
        const result = await super.execute(req, options);

        const relations = await this.lookupRelations(result);
        const relationKeys = Object.keys(relations);
        for (let i = 0; i < relationKeys.length; i++) {
            const relationKey = relationKeys[i];

            result[relationKey as keyof T] = relations[relationKey] as T[keyof T];
        }

        return result;
    }

    protected async getFields() {
        const entityMetadata = await this.getEntityMetadata();

        const fields : string[] = entityMetadata.columns.map((c) => c.propertyName);
        for (let i = 0; i < entityMetadata.relations.length; i++) {
            fields.push(entityMetadata.relations[i].propertyName);
        }

        return fields;
    }

    protected async lookupRelations(where: Partial<T>) : Promise<Partial<T>> {
        const entityMetadata = await this.getEntityMetadata();

        const output : Record<string, any> = {};
        for (let i = 0; i < entityMetadata.relations.length; i++) {
            const relation = entityMetadata.relations[i];
            const columns = relation.joinColumns.map((c) => c.propertyName);
            if (columns.length === 0) {
                continue;
            }

            const [column] = columns;

            if (!column || typeof where[column] === 'undefined') {
                continue;
            }

            const repository = this.dataSource.getRepository(relation.type);
            const entity = await repository.findOne({
                where: {
                    id: where[column],
                },
            });

            if (!entity) {
                throw new ValidationError(buildErrorMessageForAttributes([column]));
            }

            output[relation.propertyName] = entity;
        }

        return output as Partial<T>;
    }

    protected async getEntityMetadata() : Promise<EntityMetadata> {
        const index = this.dataSource.entityMetadatas.findIndex(
            (entityMetadata) => entityMetadata.target === this.target,
        );
        if (index === -1) {
            throw new ValidationError(`The entity ${this.target} is not registered.`);
        }

        return this.dataSource.entityMetadatas[index];
    }
}
