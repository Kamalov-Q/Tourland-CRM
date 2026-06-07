import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

import { UserActiveGuard } from '../../common/guards/user-active.guard';
import { ModuleAccessGuard } from '../../common/guards/module-access.guard';
import { CheckModuleAccess } from '../../common/decorators/module-access.decorator';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
    @CheckModuleAccess('departments')
    @Post()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Create department' })
    create(@Body() dto: CreateDepartmentDto) {
        return this.departmentsService.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
    @CheckModuleAccess('departments')
    @Get()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'List all departments' })
    findAll() {
        return this.departmentsService.findAll();
    }

    @UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
    @CheckModuleAccess('departments')
    @Get(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get department with clients' })
    @ApiParam({ name: 'id', description: 'Department UUID' })
    findOne(@Param('id') id: string) {
        return this.departmentsService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
    @CheckModuleAccess('departments')
    @Patch(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Update department name' })
    @ApiParam({ name: 'id', description: 'Department UUID' })
    update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
        return this.departmentsService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
    @CheckModuleAccess('departments')
    @Patch(':id/archive')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Toggle archive status' })
    @ApiParam({ name: 'id', description: 'Department UUID' })
    toggleArchive(@Param('id') id: string) {
        return this.departmentsService.toggleArchive(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
    @CheckModuleAccess('departments')
    @Delete(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete department' })
    @ApiParam({ name: 'id', description: 'Department UUID' })
    async remove(@Param('id') id: string) {
        await this.departmentsService.remove(id);
    }
}