import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { UsersService } from "./users.service";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "src/common/types/auth-request.type";
import { Roles } from "src/common/decorators/roles.decorator";
import { UserRole } from "./entities/user.entity";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UpdateDirectorProfileDto } from "./dto/update-director-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";


@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)

export class UsersController {
    constructor(private readonly usersSvc: UsersService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
    getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
        return user;
    }

    @Patch('director/profile')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Update director profile' })
    @ApiBody({ type: UpdateDirectorProfileDto })
    updateDirectorProfile(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: UpdateDirectorProfileDto,
    ) {
        return this.usersSvc.updateDirectorProfile(user.id, dto);
    }

    @Patch('director/change-password')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Change profile password' })
    @ApiBody({ type: ChangePasswordDto })
    changeDirectorPassword(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: ChangePasswordDto
    ) {
        return this.usersSvc.changeDirectorPassword(user.id, dto);
    }


    @Post('employees')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Create a new employee' })
    @ApiResponse({ status: 201, description: 'Employee created successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden - Only Directors can create employees.' })
    createEmployee(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: CreateEmployeeDto
    ) {
        return this.usersSvc.createEmployee(user.id, dto);
    }


    @Get('employees')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get list of employees created by the current director' })
    @ApiResponse({ status: 200, description: 'Employees retrieved successfully.' })
    getMyEmployees(
        @CurrentUser() user: AuthenticatedUser
    ) {
        return this.usersSvc.getMyEmployees(user.id);
    }

    @Get('employees/:id')
    @Roles(UserRole.DIRECTOR)
    getEmployeeById(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string
    ) {
        return this.usersSvc.getEmployeeById(user.id, id);
    }

    @Patch('employees/:id')
    @Roles(UserRole.DIRECTOR)
    updateEmployee(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body() dto: UpdateEmployeeDto
    ) {
        return this.usersSvc.updateEmployee(user.id, id, dto);
    }

    @Delete('employees/:id')
    @Roles(UserRole.DIRECTOR)
    deleteEmployee(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string
    ) {
        return this.usersSvc.deleteEmployee(user.id, id);
    }

}