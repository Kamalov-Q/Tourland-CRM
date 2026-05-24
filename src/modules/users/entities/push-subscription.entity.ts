import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('push_subscriptions')
export class PushSubscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    endpoint: string;

    @Column({ type: 'text', nullable: true })
    p256dh: string;

    @Column({ type: 'text', nullable: true })
    auth: string;

    @CreateDateColumn()
    createdAt: Date;
}
