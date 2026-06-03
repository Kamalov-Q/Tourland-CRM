import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { Department } from './entites/department.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Department, Client, User]),
        NotificationsModule
    ],
    controllers: [DepartmentsController],
    providers: [DepartmentsService],
    exports: [DepartmentsService, TypeOrmModule],
})
export class DepartmentsModule { }