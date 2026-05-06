import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from './task.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Task, User])],
    controllers: [TasksController],
    providers: [TasksService],
})
export class TasksModule { }