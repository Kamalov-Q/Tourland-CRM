import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";

export enum AttendanceStatus {
    PRESENT = 'PRESENT',   // Currently at work (checked in, not yet checked out)
    ATTENDED = 'ATTENDED', // Completed the day (checked out, including auto-checkout at 7 PM)
    ABSENT = 'ABSENT',     // Never showed up
}

@Entity('attendance')
export class Attendance {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    employeeId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'employeeId' })
    employee: User;

    @Column({ type: 'date' })
    date: string; // YYYY-MM-DD

    @Column({ type: 'timestamp', nullable: true })
    checkInAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    checkOutAt: Date | null;

    @Column({ type: 'text', nullable: true })
    photo: string | null;

    @Column({ type: 'text', nullable: true })
    checkOutPhoto: string | null;

    @Column({
        type: 'enum',
        enum: AttendanceStatus,
        default: AttendanceStatus.PRESENT,
    })
    status: AttendanceStatus;

    @CreateDateColumn()
    createdAt: Date;
}
