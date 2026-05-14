import { Department } from "src/modules/departments/entites/department.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ClientNote } from "./client-note.entity";
import { Payment } from "./payment.entity";
import { ClientStage, SaleStatus } from "../enums/client.enums";

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

    @ManyToOne(() => Department, (department) => department.clients, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    @Column({ type: 'jsonb', nullable: true })
    data: any | null;

    @Column({ type: 'enum', enum: ClientStage, default: ClientStage.NEW })
    stage: ClientStage;

    @Column({ type: 'enum', enum: SaleStatus, default: SaleStatus.NONE })
    saleStatus: SaleStatus;

    @Column({ type: 'float', nullable: true })
    saleTotalAmount: number | null;

    @Column({ type: 'timestamp', nullable: true })
    nextPaymentAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    soldAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    remindAt: Date | null;

    @OneToMany(() => ClientNote, (note) => note.client, { cascade: true })
    notes: ClientNote[];

    @OneToMany(() => Payment, (payment) => payment.client, { cascade: true })
    payments: Payment[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}