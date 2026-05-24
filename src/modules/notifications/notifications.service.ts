import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushSubscription as PushSubscriptionEntity } from '../users/entities/push-subscription.entity';
import { NotificationGateway } from './gateways/notification.gateway';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(PushSubscriptionEntity)
        private readonly pushRepo: Repository<PushSubscriptionEntity>,
        private readonly gateway: NotificationGateway,
        private readonly configService: ConfigService,
    ) {
        const publicVapidKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
        const privateVapidKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
        const email = this.configService.get<string>('VAPID_EMAIL', 'admin@example.com');

        if (publicVapidKey && privateVapidKey) {
            webpush.setVapidDetails(`mailto:${email}`, publicVapidKey, privateVapidKey);
        } else {
            this.logger.warn('VAPID keys not set. Web Push will not work.');
        }
    }

    async getNotifications(userId: string) {
        return this.notificationRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: 50,
        });
    }

    async markAsRead(id: string, userId: string) {
        const notification = await this.notificationRepo.findOne({ where: { id, userId } });
        if (notification) {
            notification.isRead = true;
            await this.notificationRepo.save(notification);
        }
        return notification;
    }

    async markAllAsRead(userId: string) {
        await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
        return { success: true };
    }

    async subscribe(userId: string, subscription: any) {
        // Find existing subscription for this endpoint
        let sub = await this.pushRepo.findOne({ where: { endpoint: subscription.endpoint } });
        if (!sub) {
            sub = this.pushRepo.create({
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys?.p256dh,
                auth: subscription.keys?.auth,
            });
        } else {
            sub.userId = userId;
            sub.p256dh = subscription.keys?.p256dh;
            sub.auth = subscription.keys?.auth;
        }
        return this.pushRepo.save(sub);
    }

    async createNotification(userId: string, type: any, message: string, data?: any) {
        const notification = this.notificationRepo.create({
            userId,
            type,
            message,
            isRead: false,
            data,
        });
        const saved = await this.notificationRepo.save(notification);

        // Emit via Socket.io
        // (Wait, we should ideally use the existing gateway methods or create a generic one)
        // For now, let's just use the server if accessible, or call gateway methods.
        // The current gateway has specific methods like emitTaskCreated.
        // We might want to add a generic emitNotification method.
        this.gateway.server.to(userId).emit('notification', saved);

        // Send Web Push
        this.sendWebPush(userId, {
            title: 'Tourland CRM',
            body: message,
            data: { url: '/notifications' }
        });

        return saved;
    }

    private async sendWebPush(userId: string, payload: any) {
        const subscriptions = await this.pushRepo.find({ where: { userId } });
        for (const sub of subscriptions) {
            try {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };
                await webpush.sendNotification(pushConfig, JSON.stringify(payload));
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    this.logger.log(`Removing expired subscription for user ${userId}`);
                    await this.pushRepo.remove(sub);
                } else {
                    this.logger.error(`Error sending web push: ${err.message}`);
                }
            }
        }
    }
}
