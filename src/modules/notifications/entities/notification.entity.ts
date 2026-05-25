import { BeforeInsert, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { NotificationType } from "../enums/notification-type.enum";

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    userId: string;

    @Column({
        type: 'text'
    })
    message: string;

    @Column({
        type: 'enum',
        enum: NotificationType
    })
    type: NotificationType;

    @Column({
        default: false
    })
    isRead: boolean;

    @Column({
        type: 'json',
        nullable: true
    })
    data?: any;

    @Column({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP'
    })
    createdAt: Date;

    @BeforeInsert()
    setCreatedAt() {
        this.createdAt = new Date();
    }
}