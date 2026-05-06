import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UserRole } from "./entities/user.entity";
import { Repository } from "typeorm";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import * as bcrypt from 'bcrypt';
import { UpdateDirectorProfileDto } from "./dto/update-director-profile.dto";
import { SafeUser } from "./types/safe-user.type";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

@Injectable()
export class UsersService {
    constructor(@InjectRepository(User)
    private readonly userRepo: Repository<User>) { }

    private removePassword(user: User): SafeUser {
        const { password: _password, ...safeuser } = user;
        return safeuser;
    }

    findActiveById(id: string): Promise<User | null> {
        return this.userRepo.findOne({
            where: { id, isActive: true }
        });
    }

    findByPhoneWithPassword(phoneNumber: string): Promise<User | null> {
        return this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.phoneNumber = :phoneNumber', { phoneNumber })
            .getOne();
    }

    async createEmployee(
        directorId: string,
        dto: CreateEmployeeDto
    ): Promise<SafeUser> {
        const director = await this.userRepo.findOne({
            where: {
                id: directorId,
                role: UserRole.DIRECTOR,
                isActive: true
            }
        });

        if (!director) {
            throw new ForbiddenException('Only director can create employees');
        }

        const exists = await this.userRepo.findOne({
            where: { phoneNumber: dto.phoneNumber }
        });

        if (exists) {
            throw new ConflictException('Phone number already exists');
        }

        const employee = this.userRepo.create({
            firstName: dto.firstName,
            lastName: dto.lastName,
            phoneNumber: dto.phoneNumber,
            password: await bcrypt.hash(dto.password, 10),
            role: UserRole.EMPLOYEE,
            parentId: director.id
        });

        const saved = await this.userRepo.save(employee);

        const { password: _password, ...safeUser } = saved;

        return safeUser;
    }

    getMyEmployees(directorId: string): Promise<User[]> {
        return this.userRepo.find({
            where: {
                parentId: directorId,
                role: UserRole.EMPLOYEE,
                isActive: true
            },
            order: {
                createdAt: 'DESC'
            }
        })
    }

    async getEmployeeById(
        directorId: string,
        employeeId: string,
    ): Promise<SafeUser> {
        const employee = await this.userRepo.findOne({
            where: {
                id: employeeId,
                parentId: directorId,
                role: UserRole.EMPLOYEE
            }
        });

        if (!employee) {
            throw new NotFoundException('Employeee not found');
        }

        return this.removePassword(employee);
    }

    async updateEmployee(
        directorId: string,
        employeeId: string,
        dto: UpdateEmployeeDto,
    ): Promise<SafeUser> {
        const employee = await this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.id = :employeeId', { employeeId })
            .andWhere('user.role = :role', { role: UserRole.EMPLOYEE })
            .andWhere('user.parentId = :directorId', { directorId })
            .getOne();

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        if (dto.phoneNumber && dto.phoneNumber !== employee.phoneNumber) {
            const exists = await this.userRepo.findOne({
                where: { phoneNumber: dto.phoneNumber },
            });

            if (exists) {
                throw new ConflictException('Phone number already exists');
            }

            employee.phoneNumber = dto.phoneNumber;
        }

        if (dto.firstName !== undefined) {
            employee.firstName = dto.firstName;
        }

        if (dto.lastName !== undefined) {
            employee.lastName = dto.lastName;
        }

        if (dto.password !== undefined) {
            employee.password = await bcrypt.hash(dto.password, 10);
        }

        if (dto.isActive !== undefined) {
            employee.isActive = dto.isActive;
        }

        const saved = await this.userRepo.save(employee);
        return this.removePassword(saved);
    }

    async deleteEmployee(
        directorId: string,
        employeeId: string
    ): Promise<{ message: string }> {
        const employee = await this.userRepo.findOne({
            where: {
                id: employeeId,
                role: UserRole.EMPLOYEE,
                parentId: directorId
            }
        });

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        await this.userRepo.remove(employee);

        return {
            message: 'Employee deleted successfully'
        }
    }

    async updateDirectorProfile(
        directorId: string,
        dto: UpdateDirectorProfileDto
    ): Promise<SafeUser> {
        const director = await this.userRepo.findOne({
            where: {
                id: directorId,
                role: UserRole.DIRECTOR,
                isActive: true
            }
        });

        if (!director) {
            throw new ForbiddenException('Only director can update profile');
        }

        if (dto.phoneNumber && dto.phoneNumber !== director.phoneNumber) {
            const exists = await this.userRepo.findOne({
                where: {
                    phoneNumber: dto.phoneNumber
                }
            });

            if (exists) {
                throw new ConflictException('Phone number already exists');
            }

            director.phoneNumber = dto.phoneNumber;
        }

        if (dto.firstName !== undefined) {
            director.firstName = dto.firstName;
        }

        if (dto.lastName !== undefined) {
            director.lastName = dto.lastName;
        }

        const saved = await this.userRepo.save(director);
        return this.removePassword(saved);

    }

    async changeDirectorPassword(
        directorId: string,
        dto: ChangePasswordDto
    ): Promise<{ message: string }> {
        const director = await this.userRepo
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.id = :id', { id: directorId })
            .andWhere('user.role = :role', { role: UserRole.DIRECTOR })
            .andWhere('user.isActive = true')
            .getOne();

        if (!director) {
            throw new ForbiddenException('Only director can change password');
        }

        const isPasswordValid = await bcrypt.compare(dto.oldPassword, director.password);

        if (!isPasswordValid) {
            throw new BadRequestException('Old password is incorrect');
        }

        director.password = await bcrypt.hash(dto.newPassword, 10);

        await this.userRepo.save(director);

        return {
            message: 'Password changed successfully'
        }

    }

}