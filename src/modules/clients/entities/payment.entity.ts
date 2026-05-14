import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Client } from "./client.entity";

@Entity('client_payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    clientId: string;

    @ManyToOne(() => Client, (c) => c.payments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'clientId' })
    client: Client;

    @Column({ type: 'float' })
    amount: number;

    @Column()
    authorName: string;

    @Column()
    authorRole: string;

    @CreateDateColumn()
    createdAt: Date;
}
