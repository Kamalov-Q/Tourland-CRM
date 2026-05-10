import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TaskTemplate } from "./task-template.entity";
import { TaskStatus } from "../enums/task-status.enum";

@Entity('task_instances')
export class TaskInstance {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => TaskTemplate, {
        onDelete: 'CASCADE'
    })
    @JoinColumn({ name: 'templateId' })
    template: TaskTemplate;

    @Column()
    templateId: string;

    @Index()
    @Column()
    assignedTo: string;

    @Column({
        type: 'enum',
        enum: TaskStatus,
        default: TaskStatus.TODO
    })
    status: TaskStatus;

    @Column({ type: 'date' })
    dueDate: Date;

    @Column({ type: 'timestamp' })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;


}