import { Controller, Get, UseGuards } from '@nestjs/common';
import { ArchiveService } from './archive.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types/auth-request.type';

@ApiTags('Archive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('archive')
export class ArchiveController {
    constructor(private readonly archiveService: ArchiveService) {}

    @Get('director')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Get all archive activities for director and their employees' })
    async getDirectorArchive(@CurrentUser() user: AuthenticatedUser) {
        return this.archiveService.getDirectorArchive(user.id);
    }

    @Get('employee')
    @Roles(UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get personal archive activities for employee' })
    async getEmployeeArchive(@CurrentUser() user: AuthenticatedUser) {
        return this.archiveService.getEmployeeArchive(user.id);
    }
}
