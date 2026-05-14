import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Client } from "./client.entity";

@Entity('client_notes')
export class ClientNote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    clientId: string;

    @ManyToOne(() => Client, (c) => c.notes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'clientId' })
    client: Client;

    @Column({ type: 'text' })
    text: string;

    @Column()
    authorName: string;

    @Column()
    authorRole: string;

    @CreateDateColumn()
    createdAt: Date;
}
