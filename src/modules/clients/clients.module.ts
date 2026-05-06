import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Department } from '../departments/entites/department.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Client, Department])],
    controllers: [ClientsController],
    providers: [ClientsService],
})
export class ClientsModule { }