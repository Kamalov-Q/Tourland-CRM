import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto, AddNoteDto, AddPaymentDto, SetSaleDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types/auth-request.type';
import { ClientStage } from './enums/client.enums';

import { UserActiveGuard } from '../../common/guards/user-active.guard';
import { ModuleAccessGuard } from '../../common/guards/module-access.guard';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, UserActiveGuard, ModuleAccessGuard)
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    @Post()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Create client' })
    create(
        @Body() dto: CreateClientDto,
        @CurrentUser() user: AuthenticatedUser
    ) {
        return this.clientsService.create(dto, user as AuthenticatedUser);
    }

    @Get()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'List all clients (filter by department/stage)' })
    @ApiQuery({ name: 'departmentId', required: false })
    @ApiQuery({ name: 'stage', required: false, enum: ClientStage })
    findAll(
        @Query('departmentId') departmentId?: string,
        @Query('stage') stage?: ClientStage,
    ) {
        return this.clientsService.findAll({ departmentId, stage });
    }

    @Get(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Get client with notes and payments' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    findOne(@Param('id') id: string) {
        return this.clientsService.findOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Update client details or stage' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    update(
        @Param('id') id: string, 
        @Body() dto: UpdateClientDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.clientsService.update(id, dto, user as AuthenticatedUser);
    }

    @Delete(':id')
    @Roles(UserRole.DIRECTOR)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete client (Director only)' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    async remove(@Param('id') id: string) {
        await this.clientsService.remove(id);
    }

    @Post(':id/call/start')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Start calling a client (locks client down)' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    startCall(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.clientsService.startCall(id, user as AuthenticatedUser);
    }

    @Post(':id/notes')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Add a note to client' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    addNote(
        @Param('id') id: string,
        @Body() dto: AddNoteDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.clientsService.addNote(id, dto, user as AuthenticatedUser);
    }

    @Post(':id/payments')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Record a payment for client' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    addPayment(
        @Param('id') id: string,
        @Body() dto: AddPaymentDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.clientsService.addPayment(id, dto, user as AuthenticatedUser);
    }

    @Delete('payments/:paymentId')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a payment' })
    @ApiParam({ name: 'paymentId', description: 'Payment UUID' })
    async deletePayment(
        @Param('paymentId') paymentId: string,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        await this.clientsService.deletePayment(paymentId, user as AuthenticatedUser);
    }

    @Patch(':id/sale')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Set sale status (Director and Employee)' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    setSale(
        @Param('id') id: string,
        @Body() dto: SetSaleDto,
        @CurrentUser() user: AuthenticatedUser
    ) {
        return this.clientsService.setSale(id, dto, user as AuthenticatedUser);
    }

    @Post(':id/warn')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Send warning/reminder without changing status' })
    @ApiParam({ name: 'id', description: 'Client UUID' })
    @ApiBody({ 
        schema: {
            type: 'object',
            properties: {
                remindAt: { type: 'string', example: '2026-06-01T00:00:00.000Z' }
            }
        }
    })
    warn(
        @Param('id') id: string,
        @Body() dto: { remindAt: string },
        @CurrentUser() user: AuthenticatedUser
    ) {
        return this.clientsService.warn(id, new Date(dto.remindAt), user as AuthenticatedUser);
    }

    @Post('import-excel')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Import clients from Excel file' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                departmentId: {
                    type: 'string',
                    example: 'uuid-of-department',
                },
            },
        },
    })
    async importExcel(
        @UploadedFile() file: Express.Multer.File,
        @Body('departmentId') departmentId: string,
    ) {
        if (!file) throw new BadRequestException('File is required');
        return this.clientsService.importFromExcel(file.buffer, departmentId);
    }
}