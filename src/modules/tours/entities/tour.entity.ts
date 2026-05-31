import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export interface TourService {
    nameEn: string;
    nameUz: string;
    nameRu: string;
}

@Entity('tours')
export class Tour {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    nameEn: string;

    @Column()
    nameRu: string;

    @Column()
    nameUz: string;

    @Column({ default: 0 })
    orders: number;

    @Column({ nullable: true })
    imageUrl: string;

    @Column({ nullable: true })
    link: string;

    @Column({ type: 'jsonb', default: [] })
    services: TourService[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
