import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department } from './entites/department.entity';

@Injectable()
export class DepartmentsService {
    constructor(
        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
    ) { }

    async create(dto: CreateDepartmentDto): Promise<Department> {
        const exists = await this.departmentRepo.findOne({ where: { name: dto.name } });
        if (exists) throw new ConflictException('Department already exists');
        const department = this.departmentRepo.create(dto);
        return this.departmentRepo.save(department);
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
        return this.departmentRepo.save(dep);
    }

    async toggleArchive(id: string): Promise<Department> {
        const dep = await this.findOne(id);
        dep.isArchived = !dep.isArchived;
        return this.departmentRepo.save(dep);
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