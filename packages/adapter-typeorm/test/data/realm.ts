/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Realm {
    @PrimaryGeneratedColumn('uuid')
        id: number;

    @Column()
        name: string;
}
