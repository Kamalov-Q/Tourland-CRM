import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    @Post()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Create client' })
    create(@Body() dto: CreateClientDto) {
        return this.clientsService.create(dto);
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
    findOne(@Param('id') id: string) {
        return this.clientsService.findOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Update client details or stage' })
    update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
        return this.clientsService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.DIRECTOR)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete client (Director only)' })
    async remove(@Param('id') id: string) {
        await this.clientsService.remove(id);
    }

    @Post(':id/notes')
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    @ApiOperation({ summary: 'Add a note to client' })
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
    addPayment(
        @Param('id') id: string,
        @Body() dto: AddPaymentDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.clientsService.addPayment(id, dto, user as AuthenticatedUser);
    }

    @Patch(':id/sale')
    @Roles(UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Set sale status (Director only)' })
    setSale(@Param('id') id: string, @Body() dto: SetSaleDto) {
        return this.clientsService.setSale(id, dto);
    }
}