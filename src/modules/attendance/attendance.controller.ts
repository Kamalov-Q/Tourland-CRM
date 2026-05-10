import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { AttendanceService } from "./attendance.service";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "src/common/types/auth-request.type";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import { UserRole } from "../users/entities/user.entity";
import { Roles } from "src/common/decorators/roles.decorator";

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
    constructor(private readonly attendanceSvc: AttendanceService) { }

    @Post('check-in')
    @ApiOperation({ summary: 'Employee check-in with photo' })
    checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
        return this.attendanceSvc.checkIn(user.id, dto);
    }

    @Post('check-out')
    @ApiOperation({ summary: 'Employee check-out with photo' })
    checkOut(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckOutDto) {
        return this.attendanceSvc.checkOut(user.id, dto);
    }

    @Get('my')
    @ApiOperation({ summary: 'Get current user attendance history' })
    getMyHistory(@CurrentUser() user: AuthenticatedUser) {
        return this.attendanceSvc.getMyHistory(user.id);
    }

    @Get('all')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get all attendance records (Director only)' })
    getAllAttendance() {
        return this.attendanceSvc.getAllAttendance();
    }

    @Get('employee/:id')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get specific employee attendance history' })
    getEmployeeHistory(@Param('id') id: string) {
        return this.attendanceSvc.getEmployeeHistory(id);
    }
}
