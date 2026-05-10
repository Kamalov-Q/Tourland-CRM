import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
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

    @CreateDateColumn()
    createdAt: Date;

}