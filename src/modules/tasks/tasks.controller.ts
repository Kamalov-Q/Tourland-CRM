import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksService } from './tasks.service';
import type { AuthenticatedUser } from 'src/common/types/auth-request.type';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';


@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)

export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Post()
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Create a new task' })
    @ApiResponse({ status: 201, description: 'Task created successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden - Only Directors can create tasks.' })
    createTask(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: CreateTaskDto,
    ) {
        return this.tasksService.createTask(user.id, dto);
    }


    @Get('director')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get tasks created by the current director' })
    @ApiResponse({ status: 200, description: 'Tasks retrieved successfully.' })
    getDirectorTasks(@CurrentUser() user: AuthenticatedUser) {
        return this.tasksService.getTasksForDirector(user.id);
    }


    @Get('employee')
    @Roles(UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get tasks assigned to the current employee' })
    @ApiResponse({ status: 200, description: 'Tasks retrieved successfully.' })
    getEmployeeTasks(@CurrentUser() user: AuthenticatedUser) {
        return this.tasksService.getTasksForEmployee(user.id);
    }


    @Patch(':id/complete')
    @Roles(UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Mark a task as completed' })
    @ApiResponse({ status: 200, description: 'Task marked as completed.' })
    @ApiResponse({ status: 404, description: 'Task not found or not assigned to this employee.' })
    completeTask(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') taskId: string,
    ) {
        return this.tasksService.completeTask(user.id, taskId);
    }

}