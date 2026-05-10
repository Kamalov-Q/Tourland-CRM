import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { UsersService } from "./users.service";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "src/common/types/auth-request.type";
import { Roles } from "src/common/decorators/roles.decorator";
import { UserRole } from "./entities/user.entity";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";


@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersSvc: UsersService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token.' })
    getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
        return user;
    }

    @Patch('profile')
    @ApiOperation({ summary: 'Update user profile' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token.' })
    @ApiBody({ type: UpdateProfileDto })
    updateProfile(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.usersSvc.updateProfile(user.id, dto);
    }

    @Patch('director/change-password')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Change director password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 403, description: 'Forbidden - Only Directors can create employees.' })
    @ApiBody({ type: CreateEmployeeDto })
    createEmployee(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: CreateEmployeeDto
    ) {
        return this.usersSvc.createEmployee(user.id, dto);
    }

    @Get('employees')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get all employees for the current director' })
    @ApiResponse({ status: 200, description: 'List of employees retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    getMyEmployees(@CurrentUser() user: AuthenticatedUser) {
        return this.usersSvc.getMyEmployees(user.id);
    }

    @Get('employees/:id')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get employee by ID' })
    @ApiParam({ name: 'id', description: 'Employee User ID' })
    @ApiResponse({ status: 200, description: 'Employee details retrieved successfully.' })
    getEmployeeById(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string
    ) {
        return this.usersSvc.getEmployeeById(user.id, id);
    }

    @Patch('employees/:id')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Update employee details' })
    @ApiParam({ name: 'id', description: 'Employee User ID' })
    @ApiBody({ type: UpdateEmployeeDto })
    updateEmployee(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body() dto: UpdateEmployeeDto
    ) {
        return this.usersSvc.updateEmployee(user.id, id, dto);
    }

    @Post(':id/deactivate')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiParam({ name: 'id', description: 'User ID to deactivate' })
    deactivateUser(
        @Param('id') id: string
    ) {
        return this.usersSvc.deactivateEmployee(id);
    }

    @Post(':id/activate')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Activate a user' })
    @ApiParam({ name: 'id', description: 'User ID to activate' })
    activateUser(
        @Param('id') id: string
    ) {
        return this.usersSvc.activateEmployee(id);
    }
}