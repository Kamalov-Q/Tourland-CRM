import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushSubscription as PushSubscriptionEntity } from '../users/entities/push-subscription.entity';
import { NotificationGateway } from './gateways/notification.gateway';
import { User } from '../users/entities/user.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend((utc as any).default || utc);
dayjs.extend((timezone as any).default || timezone);

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
        @InjectQueue('notification-queue')
        private readonly notificationQueue: Queue,
    ) { }

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

    async createNotification(userId: string, type: any, message: string, data?: any, options?: { skipTelegram?: boolean; user?: User }) {
        const notification = this.notificationRepo.create({
            userId,
            type,
            message,
            isRead: false,
            data,
        });
        const saved = await this.notificationRepo.save(notification);

        // Instant delivery
        this.gateway.server.to(userId).emit('notification', saved);

        // Determine redirect URL
        const redirectUrl = options?.user?.role === 'DIRECTOR' ? '/director/notifications' : '/employee/notifications';

        // Offload heavy delivery to BullMQ
        await this.notificationQueue.add('send-delivery', {
            userId,
            message,
            payload: {
                title: 'Tourland CRM',
                body: message,
                data: { url: redirectUrl }
            },
            options: {
                skipTelegram: options?.skipTelegram
            }
        });

        return saved;
    }

    async createBatchNotifications(userIds: string[], type: any, message: string, data?: any, options?: { skipTelegram?: boolean }) {
        const notifications = userIds.map(userId => this.notificationRepo.create({
            userId,
            type,
            message,
            isRead: false,
            data,
        }));

        const saved = await this.notificationRepo.save(notifications);

        const users = await this.userRepo.findBy({ id: In(userIds) });
        const userMap = new Map(users.map(u => [u.id, u]));

        // Batch process delivery jobs
        const jobs = saved.map(n => {
            const user = userMap.get(n.userId);
            const redirectUrl = user?.role === 'DIRECTOR' ? '/director/notifications' : '/employee/notifications';

            return {
                name: 'send-delivery',
                data: {
                    userId: n.userId,
                    message,
                    payload: {
                        title: 'Tourland CRM',
                        body: message,
                        data: { url: redirectUrl }
                    },
                    options: {
                        skipTelegram: options?.skipTelegram
                    }
                }
            };
        });

        // Emit sockets instantly
        saved.forEach(n => this.gateway.server.to(n.userId).emit('notification', n));

        // Add all jobs to queue
        await this.notificationQueue.addBulk(jobs);

        return saved;
    }
}
