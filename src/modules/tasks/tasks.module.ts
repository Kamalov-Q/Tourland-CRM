import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskTemplate } from './entities/task-template.entity';
import { TaskInstance } from './entities/task-instance.entity';
import { TaskStatusHistory } from './entities/task-status-history.entity';
import { Notification } from './entities/notification.entity';
import { BullModule } from '@nestjs/bullmq';
import { TasksProcessor } from './processors/task.processor';
import { TasksCron } from './cron/tasks.cron';
import { NotificationGateway } from './gateways/notification.gateway';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { forwardRef } from '@nestjs/common';

@Module({
    imports: [TypeOrmModule.forFeature([
        TaskTemplate,
        TaskInstance,
        TaskStatusHistory,
        Notification,
        User
    ]),
    forwardRef(() => UsersModule),
    // Redis Queue
    BullModule.registerQueue({
        name: 'task-queue',
    }),
    ],
    controllers: [TasksController],
    providers: [
        TasksService,
        TasksProcessor,
        TasksCron,
        NotificationGateway
    ],
    exports: [TasksService]
})
export class TasksModule { }