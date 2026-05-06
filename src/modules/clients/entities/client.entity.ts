import { Department } from "src/modules/departments/entites/department.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


@Entity('clients')
export class Client {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    fullName: string;

    @Column()
    phoneNumber: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'uuid' })
    departmentId: string;

    @ManyToOne(() => Department, (department) => department.clients, {
        onDelete: 'RESTRICT'
    })
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}