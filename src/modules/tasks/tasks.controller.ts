import {
    Controller,
    Post,
    Patch,
    Get,
    Body,
    Param,
    Req,
    UseGuards,
} from '@nestjs/common';

import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import type { AuthenticatedUser } from 'src/common/types/auth-request.type';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)

@Controller('tasks')
export class TasksController {

    constructor(
        private readonly tasksService:
            TasksService,
    ) { }

    // CREATE TEMPLATE
    @Post('template')

    @ApiOperation({
        summary:
            'Director creates repetitive task template',
    })

    @ApiBody({
        type:
            CreateTaskTemplateDto,
    })

    createTemplate(

        @Body()
        dto:
            CreateTaskTemplateDto,

        @Req()
        req: AuthenticatedUser,
    ) {

        return this.tasksService
            .createTemplate(
                dto,
                req.id,
            );
    }

    // UPDATE TASK STATUS
    @Patch(':id/status')

    @ApiOperation({
        summary:
            'Employee updates task status',
    })

    @ApiParam({
        name: 'id',
        example:
            'uuid',
    })

    @ApiBody({
        type:
            UpdateTaskStatusDto,
    })

    updateTaskStatus(

        @Param('id')
        id: string,

        @Body()
        dto:
            UpdateTaskStatusDto,

        @Req()
        req: AuthenticatedUser,
    ) {

        return this.tasksService
            .updateTaskStatus(
                id,
                dto.status,
                req.id,
            );
    }

    // VERIFY TASK
    @Patch(':id/verify')

    @ApiOperation({
        summary:
            'Director verifies employee task',
    })

    @ApiParam({
        name: 'id',
    })

    verifyTask(

        @Param('id')
        id: string,

        @Req()
        req: AuthenticatedUser,
    ) {

        return this.tasksService
            .verifyTask(
                id,
                req.id,
            );
    }

    // REJECT TASK
    @Patch(':id/reject')

    @ApiOperation({
        summary:
            'Director rejects employee task',
    })

    rejectTask(

        @Param('id')
        id: string,

        @Req()
        req: AuthenticatedUser,
    ) {

        return this.tasksService
            .rejectTask(
                id,
                req.id,
            );
    }

    // TASK HISTORY
    @Get(':id/history')

    @ApiOperation({
        summary:
            'Get task history timeline',
    })

    getTaskHistory(

        @Param('id')
        id: string,
    ) {

        return this.tasksService
            .getTaskHistory(id);
    }

    // EMPLOYEE TASKS
    @Get('employee/me')

    @ApiOperation({
        summary:
            'Employee task dashboard',
    })

    getEmployeeTasks(
        @Req() req: AuthenticatedUser,
    ) {

        return this.tasksService
            .getEmployeeTasks(
                req.id,
            );
    }

    // DIRECTOR DASHBOARD
    @Get('director/dashboard')

    @ApiOperation({
        summary:
            'Director task dashboard',
    })

    getDirectorDashboard(
        @Req() req: AuthenticatedUser,
    ) {

        return this.tasksService
            .getDirectorDashboard(
                req.id,
            );
    }
}