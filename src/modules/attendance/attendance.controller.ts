import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { AttendanceService } from "./attendance.service";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthenticatedUser } from "src/common/types/auth-request.type";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import { UserRole } from "../users/entities/user.entity";
import { Roles } from "src/common/decorators/roles.decorator";

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
    constructor(private readonly attendanceSvc: AttendanceService) { }

    @Get()
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'List attendance records with filters (Director only)' })
    list(@Query('employeeId') employeeId?: string, @Query('date') date?: string) {
        return this.attendanceSvc.find({ employeeId, date });
    }

    @Post('check-in')
    @Roles(UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Employee check-in with photo' })
    checkIn(@CurrentUser() user: any, @Body() dto: CheckInDto) {
        return this.attendanceSvc.checkIn((user as AuthenticatedUser).id, dto);
    }

    @Post('check-out')
    @Roles(UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Employee check-out with photo' })
    checkOut(@CurrentUser() user: any, @Body() dto: CheckOutDto) {
        return this.attendanceSvc.checkOut((user as AuthenticatedUser).id, dto);
    }

    @Get('my')
    @Roles(UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get current employee attendance history' })
    getMyHistory(@CurrentUser() user: any) {
        return this.attendanceSvc.getHistory((user as AuthenticatedUser).id);
    }

    @Get('employee/:id')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get specific employee attendance history (Director only)' })
    getEmployeeHistory(@Param('id') id: string) {
        return this.attendanceSvc.getHistory(id);
    }
}
