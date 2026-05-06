import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentsService } from './departments.service';
import type { AuthenticatedUser } from 'src/common/types/auth-request.type';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @Post()
    @Roles(UserRole.DIRECTOR)
    create(
        @CurrentUser() _user: AuthenticatedUser,
        @Body() dto: CreateDepartmentDto,
    ) {
        return this.departmentsService.create(dto);
    }

    @Get()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    findAll() {
        return this.departmentsService.findAll();
    }
}