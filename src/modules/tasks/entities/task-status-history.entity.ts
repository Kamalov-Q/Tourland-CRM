import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TaskInstance } from "./task-instance.entity";
import { TaskStatus } from "../enums/task-status.enum";

Entity('task_status_history')
export class TaskStatusHistory {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => TaskInstance, {
        onDelete: 'CASCADE'
    })
    @JoinColumn({ name: 'taskId' })
    task: TaskInstance;

    @Column()
    taskId: string;

    @Column({
        type: 'enum',
        enum: TaskStatus
    })
    oldStatus: TaskStatus;

    @Column({
        type: 'enum',
        enum: TaskStatus
    })
    newStatus: TaskStatus;

    @Column()
    changedBy: string;

    @CreateDateColumn()
    changedAt: Date;


}