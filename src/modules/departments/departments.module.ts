import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { Department } from './entites/department.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Department, Client])],
    controllers: [DepartmentsController],
    providers: [DepartmentsService],
    exports: [DepartmentsService, TypeOrmModule],
})
export class DepartmentsModule { }