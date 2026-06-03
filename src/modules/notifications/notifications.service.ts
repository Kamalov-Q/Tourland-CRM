import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushSubscription as PushSubscriptionEntity } from '../users/entities/push-subscription.entity';
import { NotificationGateway } from './gateways/notification.gateway';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../telegram/telegram.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(PushSubscriptionEntity)
        private readonly pushRepo: Repository<PushSubscriptionEntity>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly gateway: NotificationGateway,
        private readonly configService: ConfigService,
        private readonly telegramService: TelegramService,
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

    async getNotifications(userId: string, page: number = 1, limit: number = 20) {
        const [items, total] = await this.notificationRepo.findAndCount({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit || 100,
            skip: ((page || 1) - 1) * (limit || 100),
        });
        return {
            items,
            total,
            page: Number(page) || 1,
            limit: Number(limit) || 100,
            totalPages: Math.ceil(total / (limit || 100))
        };
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

    private isAllowedTime(): boolean {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 9 && hour < 22;
    }

    async createNotification(userId: string, type: any, message: string, data?: any, options?: { skipTelegram?: boolean }) {
        const notification = this.notificationRepo.create({
            userId,
            type,
            message,
            isRead: false,
            data,
        });
        const saved = await this.notificationRepo.save(notification);

        // Only deliver (Socket, Push, Telegram) if within allowed hours (09:00 - 22:00)
        if (this.isAllowedTime()) {
            // Emit via Socket.io
            this.gateway.server.to(userId).emit('notification', saved);

            const user = await this.userRepo.findOne({ where: { id: userId } });
            const redirectUrl = user?.role === 'DIRECTOR' ? '/director/notifications' : '/employee/notifications';

            // Send Web Push
            this.sendWebPush(userId, {
                title: 'Tourland CRM',
                body: message,
                data: { url: redirectUrl }
            });

            // Send Telegram
            if (!options?.skipTelegram) {
                this.sendTelegram(userId, message).catch(err => 
                    this.logger.error(`Immediate Telegram notification failed: ${err.message}`)
                );
            }
        }

        return saved;
    }

    private async sendTelegram(userId: string, message: string) {
        try {
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (user) {
                if (user.telegramId) {
                    await this.telegramService.sendMessage([user.telegramId], `🔔 <b>Yangi bildirishnoma:</b>\n\n${message}`);
                } else if (user.phoneNumber) {
                    await this.telegramService.sendToEmployee(user.phoneNumber, `🔔 <b>Yangi bildirishnoma:</b>\n\n${message}`);
                }
            }
        } catch (err) {
            this.logger.error(`Failed to send Telegram notification to user ${userId}: ${err.message}`);
        }
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
