import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    @Post()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    create(@Body() dto: CreateClientDto) {
        return this.clientsService.create(dto);
    }

    @Get()
    @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
    findAll() {
        return this.clientsService.findAll();
    }
}