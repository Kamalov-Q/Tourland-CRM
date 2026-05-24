import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Attendance } from "./entities/attendance.entity";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { ActivityLog } from "../archive/entities/activity-log.entity";
import { TasksModule } from "../tasks/tasks.module";
import { User } from "../users/entities/user.entity";
import { AttendanceCron } from "./cron/attendance.cron";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([Attendance, ActivityLog, User]),
        TasksModule,
        NotificationsModule,
    ],
    providers: [AttendanceService, AttendanceCron],
    controllers: [AttendanceController],
    exports: [AttendanceService]
})
export class AttendanceModule { }
