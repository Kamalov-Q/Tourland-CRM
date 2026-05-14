import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @Post()
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Create department (Director only)' })
    create(@Body() dto: CreateDepartmentDto) {
        return this.departmentsService.create(dto);
    }

    @Get()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'List all departments' })
    findAll() {
        return this.departmentsService.findAll();
    }

    @Get(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get department with clients' })
    findOne(@Param('id') id: string) {
        return this.departmentsService.findOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Update department name (Director only)' })
    update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
        return this.departmentsService.update(id, dto);
    }

    @Patch(':id/archive')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Toggle archive status (Director only)' })
    toggleArchive(@Param('id') id: string) {
        return this.departmentsService.toggleArchive(id);
    }

    @Delete(':id')
    @Roles(UserRole.DIRECTOR)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete department (Director only)' })
    async remove(@Param('id') id: string) {
        await this.departmentsService.remove(id);
    }
}