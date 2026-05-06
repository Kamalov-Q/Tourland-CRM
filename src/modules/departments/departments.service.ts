import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { Department } from './entites/department.entity';

@Injectable()
export class DepartmentsService {
    constructor(
        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
    ) { }

    async create(dto: CreateDepartmentDto): Promise<Department> {
        const exists = await this.departmentRepo.findOne({
            where: { name: dto.name },
        });

        if (exists) {
            throw new ConflictException('Department already exists');
        }

        const department = this.departmentRepo.create(dto);

        return this.departmentRepo.save(department);
    }

    findAll(): Promise<Department[]> {
        return this.departmentRepo.find({
            order: { createdAt: 'DESC' },
        });
    }
}