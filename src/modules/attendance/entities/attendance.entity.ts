import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity('attendance')
export class Attendance {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'date' })
    date: string; // YYYY-MM-DD

    @Column({ type: 'timestamp' })
    checkInAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    checkOutAt: Date | null;

    @Column({ type: 'text', nullable: true })
    checkInPhoto: string | null;

    @Column({ type: 'text', nullable: true })
    checkOutPhoto: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
