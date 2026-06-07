import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @ApiOperation({ summary: 'Get current user notifications' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
    getNotifications(
        @Request() req,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ) {
        return this.notificationsService.getNotifications(
            req.user.id || req.user.sub, 
            page ? Number(page) : 1, 
            limit ? Number(limit) : 20
        );
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark single notification as read' })
    @ApiParam({ name: 'id', description: 'Notification UUID' })
    markAsRead(@Param('id') id: string, @Request() req) {
        return this.notificationsService.markAsRead(id, req.user.id || req.user.sub);
    }

    @Post('read-all')
    @ApiOperation({ summary: 'Mark all notification as read' })
    markAllAsRead(@Request() req) {
        return this.notificationsService.markAllAsRead(req.user.id || req.user.sub);
    }

    @Post('push-subscribe')
    @ApiOperation({ summary: 'Subscribe to web push notifications' })
    subscribe(@Body() subscription: any, @Request() req) {
        return this.notificationsService.subscribe(req.user.id || req.user.sub, subscription);
    }
}
