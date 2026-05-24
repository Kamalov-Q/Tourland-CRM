import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskTemplate } from './entities/task-template.entity';
import { TaskInstance } from './entities/task-instance.entity';
import { TaskStatusHistory } from './entities/task-status-history.entity';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksProcessor } from './processors/task.processor';
import { TasksCron } from './cron/tasks.cron';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { ActivityLog } from '../archive/entities/activity-log.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TaskTemplate,
            TaskInstance,
            TaskStatusHistory,
            User,
            ActivityLog,
            Notification
        ]),
        forwardRef(() => UsersModule),
        NotificationsModule,
        BullModule.registerQueue({
            name: 'task-queue',
        }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configSvc: ConfigService) => ({
                secret: configSvc.getOrThrow<string>('JWT_SECRET'),
            }),
        }),
    ],
    controllers: [TasksController],
    providers: [
        TasksService,
        TasksProcessor,
        TasksCron,
    ],
    exports: [TasksService]
})
export class TasksModule { }