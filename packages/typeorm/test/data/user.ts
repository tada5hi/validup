/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Realm } from './realm';

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
        id: number;

    @Column()
        name: string;

    @Column()
        realm_id: string;

    @ManyToOne(() => Realm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'realm_id' })
        realm: Realm;
}
