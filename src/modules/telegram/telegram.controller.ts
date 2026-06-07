import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TelegramService } from './telegram.service';
import { BroadcastMessageDto } from './dto/broadcast-message.dto';
import { ClientMessageDto } from './dto/client-message.dto';

@ApiTags('Telegram')
@ApiBearerAuth()
@Controller('telegram')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('users')
  @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List all Telegram bot users' })
  findAll() {
    return this.telegramService.findAll();
  }

  @Post('broadcast')
  @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Send message to selected Telegram users' })
  async broadcast(@Body() dto: BroadcastMessageDto) {
    const message = `<b>${dto.description}</b>${dto.link ? `\n\n<a href="${dto.link}">Havola: ${dto.link}</a>` : ''}`;
    await this.telegramService.sendMessage(dto.telegramIds, message);
    return { success: true };
  }

  @Post('client-message')
  @Roles(UserRole.DIRECTOR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Send message to client and link Telegram ID' })
  async sendToClient(@Body() dto: ClientMessageDto) {
    const message = `<b>${dto.description}</b>${dto.link ? `\n\n<a href="${dto.link}">Havola: ${dto.link}</a>` : ''}`;
    await this.telegramService.sendClientMessage(dto.clientId, dto.telegramId, message);
    return { success: true };
  }
}
