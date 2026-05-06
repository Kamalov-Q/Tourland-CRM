import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateClientDto } from './dto/create-client.dto';
import { Client } from './entities/client.entity';
import { Department } from '../departments/entites/department.entity';

@Injectable()
export class ClientsService {
    constructor(
        @InjectRepository(Client)
        private readonly clientRepo: Repository<Client>,

        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
    ) { }

    async create(dto: CreateClientDto): Promise<Client> {
        const department = await this.departmentRepo.findOne({
            where: { id: dto.departmentId },
        });

        if (!department) {
            throw new BadRequestException('Department not found');
        }

        const client = this.clientRepo.create({
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            description: dto.description ?? null,
            departmentId: department.id,
        });

        return this.clientRepo.save(client);
    }

    findAll(): Promise<Client[]> {
        return this.clientRepo.find({
            relations: {
                department: true,
            },
            order: {
                createdAt: 'DESC',
            },
        });
    }
}