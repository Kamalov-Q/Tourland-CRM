import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum UserRole {
    DIRECTOR = 'DIRECTOR',
    EMPLOYEE = 'EMPLOYEE',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Index({ unique: true })
    @Column()
    phoneNumber: string;

    @Column({ select: false })
    password: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.EMPLOYEE
    })
    role: UserRole;

    @Column({ type: 'uuid', nullable: true })
    parentId: string | null;

    @ManyToOne(() => User, (user) => user.employees, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'parentId' })
    director: User | null;

    @OneToMany(() => User, (user) => user.director)
    employees: User[];

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
