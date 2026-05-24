import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { PushSubscription } from "./entities/push-subscription.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UsersSeeder } from "./users.seeder";
import { TasksModule } from "../tasks/tasks.module";
import { ActivityLog } from "../archive/entities/activity-log.entity";

@Module({
    imports: [TypeOrmModule.forFeature([User, ActivityLog, PushSubscription]), forwardRef(() => TasksModule)],
    controllers: [UsersController],
    providers: [UsersService, UsersSeeder],
    exports: [UsersService, TypeOrmModule]
})
export class UsersModule { }