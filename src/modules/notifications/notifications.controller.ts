import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    getNotifications(
        @Request() req,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        return this.notificationsService.getNotifications(req.user.id || req.user.sub, page, limit);
    }

    @Patch(':id/read')
    markAsRead(@Param('id') id: string, @Request() req) {
        return this.notificationsService.markAsRead(id, req.user.id || req.user.sub);
    }

    @Post('read-all')
    markAllAsRead(@Request() req) {
        return this.notificationsService.markAllAsRead(req.user.id || req.user.sub);
    }

    @Post('push-subscribe')
    subscribe(@Body() subscription: any, @Request() req) {
        return this.notificationsService.subscribe(req.user.id || req.user.sub, subscription);
    }
}
