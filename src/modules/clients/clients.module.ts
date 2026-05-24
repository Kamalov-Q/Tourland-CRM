import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { ClientNote } from './entities/client-note.entity';
import { Payment } from './entities/payment.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Department } from '../departments/entites/department.entity';
import { ActivityLog } from '../archive/entities/activity-log.entity';
import { ClientsGateway } from './gateways/clients.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [TypeOrmModule.forFeature([Client, ClientNote, Payment, Department, ActivityLog]), NotificationsModule],
    controllers: [ClientsController],
    providers: [ClientsService, ClientsGateway],
})
export class ClientsModule { }