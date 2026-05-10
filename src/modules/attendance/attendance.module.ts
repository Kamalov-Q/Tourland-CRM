import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Attendance } from "./entities/attendance.entity";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";

@Module({
    imports: [TypeOrmModule.forFeature([Attendance])],
    providers: [AttendanceService],
    controllers: [AttendanceController],
    exports: [AttendanceService]
})
export class AttendanceModule { }
