import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { PushSubscription } from '../users/entities/push-subscription.entity';
import { NotificationGateway } from './gateways/notification.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification, PushSubscription]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configSvc: ConfigService) => ({
                secret: configSvc.getOrThrow<string>('JWT_SECRET'),
            }),
        }),
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, NotificationGateway],
    exports: [NotificationsService, NotificationGateway],
})
export class NotificationsModule {}
