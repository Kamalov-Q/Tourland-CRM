import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department } from './entites/department.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class DepartmentsService {
    constructor(
        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly notificationsService: NotificationsService,
    ) { }

    async create(dto: CreateDepartmentDto): Promise<Department> {
        const exists = await this.departmentRepo.findOne({ where: { name: dto.name } });
        if (exists) throw new ConflictException('Department already exists');
        const department = this.departmentRepo.create(dto);
        const saved = await this.departmentRepo.save(department);

        // Notify directors (async)
        this.getDirectorIds().then(directorIds => {
            for (const id of directorIds) {
                this.notificationsService.createNotification(
                    id,
                    NotificationType.DEPARTMENT_UPDATE,
                    `🏢 Yangi bo'lim qo'shildi: ${saved.name}`,
                    { departmentId: saved.id }
                ).catch(err => console.error('Notification failed', err));
            }
        });

        return saved;
    }

    findAll(): Promise<Department[]> {
        return this.departmentRepo.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string): Promise<Department> {
        const dep = await this.departmentRepo.findOne({ where: { id }, relations: ['clients'] });
        if (!dep) throw new NotFoundException('Department not found');
        return dep;
    }

    async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
        const dep = await this.findOne(id);
        if (dto.name && dto.name !== dep.name) {
            const exists = await this.departmentRepo.findOne({ where: { name: dto.name } });
            if (exists) throw new ConflictException('Department name already used');
        }
        Object.assign(dep, dto);
        const saved = await this.departmentRepo.save(dep);

        // Notify directors (async)
        this.getDirectorIds().then(directorIds => {
            for (const id of directorIds) {
                this.notificationsService.createNotification(
                    id,
                    NotificationType.DEPARTMENT_UPDATE,
                    `📝 Bo'lim tahrirlandi: ${saved.name}`,
                    { departmentId: saved.id }
                ).catch(err => console.error('Notification failed', err));
            }
        });

        return saved;
    }

    async toggleArchive(id: string): Promise<Department> {
        const dep = await this.findOne(id);
        dep.isArchived = !dep.isArchived;
        const saved = await this.departmentRepo.save(dep);

        // Notify directors (async)
        this.getDirectorIds().then(directorIds => {
            for (const dirId of directorIds) {
                this.notificationsService.createNotification(
                    dirId,
                    NotificationType.DEPARTMENT_UPDATE,
                    `📦 Bo'lim ${saved.isArchived ? 'arxivlandi' : 'arxivdan chiqarildi'}: ${saved.name}`,
                    { departmentId: saved.id }
                ).catch(err => console.error('Notification failed', err));
            }
        });

        return saved;
    }

    private async getDirectorIds(): Promise<string[]> {
        const directors = await this.userRepo.find({
            where: { role: UserRole.DIRECTOR },
            select: ['id']
        });
        return directors.map(d => d.id);
    }

    async remove(id: string): Promise<void> {
        const dep = await this.findOne(id);
        try {
            await this.departmentRepo.remove(dep);
        } catch (error) {
            throw new BadRequestException('Cannot delete department with active clients or related forms. Please archive it instead.');
        }
    }
}