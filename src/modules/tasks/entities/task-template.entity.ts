
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('task_templates')
export class TaskTemplate {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({
        type: 'text',
        nullable: true,
    })
    description?: string;

    // employee id
    @Index()
    @Column()
    assignedTo: string;

    // director id
    @Index()
    @Column()
    createdBy: string;

    // 09:00
    @Column()
    notifyAt: string;

    @Column({
        type: 'timestamp',
    })
    startDate: Date;

    @Column({
        type: 'timestamp',
    })
    endDate: Date;

    @Column({
        default: true,
    })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;
}