import { BadRequestException, Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto, AddNoteDto, AddPaymentDto, SetSaleDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';
import { ClientNote } from './entities/client-note.entity';
import { Payment } from './entities/payment.entity';
import { Department } from '../departments/entites/department.entity';
import { ClientStage, SaleStatus } from './enums/client.enums';
import { AuthenticatedUser } from 'src/common/types/auth-request.type';
import { ActivityLog } from '../archive/entities/activity-log.entity';
import { ClientsGateway } from './gateways/clients.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual, IsNull } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { TelegramService } from '../telegram/telegram.service';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend((utc as any).default || utc);
dayjs.extend((timezone as any).default || timezone);

@Injectable()
export class ClientsService {
    private readonly logger = new Logger(ClientsService.name);

    constructor(
        @InjectRepository(Client)
        private readonly clientRepo: Repository<Client>,

        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,

        @InjectRepository(ClientNote)
        private readonly noteRepo: Repository<ClientNote>,

        @InjectRepository(Payment)
        private readonly paymentRepo: Repository<Payment>,

        @InjectRepository(ActivityLog)
        private readonly activityRepo: Repository<ActivityLog>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        private readonly clientsGateway: ClientsGateway,

        private readonly notificationsService: NotificationsService,

        private readonly telegramService: TelegramService,

        private readonly dataSource: DataSource,
    ) { }

    async create(dto: CreateClientDto, user?: AuthenticatedUser): Promise<Client> {
        const department = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
        if (!department) throw new BadRequestException('Department not found');

        const client = this.clientRepo.create({
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            description: dto.description ?? null,
            departmentId: department.id,
        });

        const saved = await this.clientRepo.save(client);

        const fullClient = await this.findOne(saved.id);

        this.clientsGateway.emitClientUpdate(fullClient.id, fullClient);

        await this.activityRepo.save({
            actionType: 'CLIENT_CREATED',
            details: { clientId: saved.id, fullName: saved.fullName }
        });

        // Notify ALL users (async)
        this.getAllUserIds().then(userIds => {
            if (userIds.length > 0) {
                this.notificationsService.createBatchNotifications(
                    userIds,
                    NotificationType.CLIENT_CREATED,
                    `🆕 Yangi mijoz qo'shildi: ${saved.fullName}. Uni "Yangi" bo'limidan ko'rishingiz mumkin.`,
                    { clientId: saved.id },
                    { skipTelegram: true }
                ).catch(err => this.logger.error('Batch notification failed', err));
            }
        });

        return saved;
    }

    findAll(query: { departmentId?: string; stage?: ClientStage }): Promise<Client[]> {
        const where: any = {};
        if (query.departmentId) where.departmentId = query.departmentId;
        if (query.stage) where.stage = query.stage;

        return this.clientRepo.find({
            where,
            relations: { department: true, notes: true, payments: true },
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Client> {
        const client = await this.clientRepo.findOne({
            where: { id },
            relations: { department: true, notes: true, payments: true },
        });
        if (!client) throw new NotFoundException('Client not found');
        return client;
    }

    async update(id: string, dto: UpdateClientDto, user: AuthenticatedUser): Promise<Client> {
        const client = await this.findOne(id);
        if (dto.departmentId && dto.departmentId !== client.departmentId) {
            const dep = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
            if (!dep) throw new BadRequestException('Department not found');
        }
        if ((dto.fullName || dto.phoneNumber) && user.role !== UserRole.DIRECTOR) {
            throw new ForbiddenException('Only directors can update name and phone number');
        }
        Object.assign(client, dto);

        // If the stage is changing away from NEW/IN_PROGRESS, we typically end the call, but let's clear call fields if stage goes to NO_ANSWER, TALKED, or SOLD
        if (dto.stage && dto.stage !== ClientStage.NEW) {
            client.inCallByEmployeeId = null;
            client.inCallByName = null;
            client.callStartedAt = null;
            this.clientsGateway.emitCallEnded(client.id);
        }

        // Reset notification timer if stage changes
        if (dto.stage) {
            client.lastCallReminderNotifiedAt = null;
        }

        // Track who set the reminder or who is responsible for no-answer follow-up
        if (dto.remindAt || dto.stage === ClientStage.NO_ANSWER) {
            client.remindEmployeeId = user.id;
        }

        const saved = await this.clientRepo.save(client);

        this.clientsGateway.emitClientUpdate(client.id, saved);

        await this.activityRepo.save({
            actionType: 'CLIENT_UPDATED',
            details: { clientId: saved.id, fullName: saved.fullName, updates: Object.keys(dto) }
        });

        return saved;
    }

    async startCall(id: string, user: AuthenticatedUser): Promise<Client> {
        const client = await this.findOne(id);

        if (client.inCallByEmployeeId && client.inCallByEmployeeId !== user.id) {
            throw new BadRequestException(`Ushbu mijoz bilan xozirda ${client.inCallByName} gaplashmoqda.`);
        }

        client.inCallByEmployeeId = user.id;
        client.inCallByName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phoneNumber;
        client.callStartedAt = new Date();

        const saved = await this.clientRepo.save(client);

        this.clientsGateway.emitCallStarted(client.id, user.id, client.inCallByName);

        await this.activityRepo.save({
            actionType: 'CLIENT_CALL_STARTED',
            userId: user.id || undefined,
            details: { clientId: saved.id, fullName: saved.fullName }
        });

        return saved;
    }

    async remove(id: string): Promise<void> {
        const client = await this.findOne(id);
        await this.clientRepo.remove(client);
    }

    async warn(id: string, remindAt: Date, user: AuthenticatedUser): Promise<Client> {
        const client = await this.findOne(id);

        client.remindAt = remindAt;
        client.remindEmployeeId = user.id;
        // Specifically NO stage change to no_answer as per user request

        const saved = await this.clientRepo.save(client);

        this.clientsGateway.emitClientUpdate(client.id, saved);

        await this.activityRepo.save({
            actionType: 'CLIENT_WARN_SENT',
            userId: user.id || undefined,
            details: { clientId: saved.id, fullName: saved.fullName, remindAt }
        });

        // Notify ALL users (async)
        this.getAllUserIds().then(userIds => {
            const otherUserIds = userIds.filter(id => id !== user.id);
            if (otherUserIds.length > 0) {
                this.notificationsService.createBatchNotifications(
                    otherUserIds,
                    NotificationType.CLIENT_REMINDER,
                    `⚠️ "${client.fullName}" uchun qayta eslatma belgilandi.`,
                    { clientId: client.id },
                    { skipTelegram: true }
                ).catch(err => this.logger.error('Warn notification failed', err));
            }
        });

        return saved;
    }

    async addNote(clientId: string, dto: AddNoteDto, user: AuthenticatedUser): Promise<ClientNote> {
        await this.findOne(clientId); // verify exists
        const note = this.noteRepo.create({
            clientId,
            text: dto.text,
            authorName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phoneNumber,
            authorRole: user.role,
        });
        const saved = await this.noteRepo.save(note);

        await this.activityRepo.save({
            userId: user.id || undefined,
            actionType: 'CLIENT_NOTE_ADDED',
            details: { clientId, text: saved.text }
        });

        // Notify ALL users (async)
        const client = await this.findOne(clientId);
        this.getAllUserIds().then(userIds => {
            const otherUserIds = userIds.filter(id => id !== user.id);
            if (otherUserIds.length > 0) {
                this.notificationsService.createBatchNotifications(
                    otherUserIds,
                    NotificationType.CLIENT_REMINDER,
                    `📝 "${client.fullName}" uchun yangi izoh: ${dto.text}`,
                    { clientId: client.id },
                    { skipTelegram: true }
                ).catch(err => this.logger.error('Note notification failed', err));
            }
        });

        return saved;
    }

    async addPayment(clientId: string, dto: AddPaymentDto, user: AuthenticatedUser): Promise<Payment> {
        return this.dataSource.transaction(async (manager) => {
            const client = await manager.findOne(Client, { where: { id: clientId } });
            if (!client) throw new NotFoundException('Client not found');

            const payment = manager.create(Payment, {
                clientId,
                amount: dto.amount,
                authorName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phoneNumber,
                authorRole: user.role,
            });
            const saved = await manager.save(payment);

            // Auto-complete sale if total paid >= saleTotalAmount
            if (client.saleTotalAmount && client.saleStatus !== SaleStatus.FULL) {
                const allPayments = await manager.find(Payment, { where: { clientId } });
                const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

                if (totalPaid >= client.saleTotalAmount) {
                    client.saleStatus = SaleStatus.FULL;
                    client.soldAt = new Date();
                    client.stage = ClientStage.SOLD;
                    await manager.save(client);
                } else if (totalPaid > 0) {
                    client.saleStatus = SaleStatus.PARTIAL;
                    await manager.save(client);
                }
            }

            await manager.save(ActivityLog, {
                userId: user.id || undefined,
                actionType: 'CLIENT_PAYMENT_ADDED',
                details: { clientId, amount: payment.amount }
            });

            // Notify ALL users (async)
            this.getAllUserIds().then(userIds => {
                const otherUserIds = userIds.filter(id => id !== user.id);
                if (otherUserIds.length > 0) {
                    this.notificationsService.createBatchNotifications(
                        otherUserIds,
                        NotificationType.CLIENT_PAYMENT,
                        `💰 "${client.fullName}" uchun ${payment.amount} so'm to'lov qabul qilindi.`,
                        { clientId, paymentId: saved.id },
                        { skipTelegram: true }
                    ).catch(err => this.logger.error('Batch payment notification failed', err));
                }
            });

            // Notify CLIENT via Telegram (async) if linked
            if (client.telegramId) {
                const clientMessage = `✅ <b>To'lov qabul qilindi!</b>\n\nHurmatli mijoz, sizning <b>${payment.amount.toLocaleString()} so'm</b> miqdoridagi to'lovingiz muvaffaqiyatli qabul qilindi.\n\nIshonchingiz uchun rahmat! ✨`;
                this.telegramService.sendMessage([client.telegramId], clientMessage)
                    .catch(err => this.logger.error(`Failed to send payment confirmation to client ${client.id}: ${err.message}`));
            }

            return saved;
        });
    }

    async deletePayment(paymentId: string, user: AuthenticatedUser): Promise<void> {
        return this.dataSource.transaction(async (manager) => {
            const payment = await manager.findOne(Payment, {
                where: { id: paymentId },
                relations: { client: true }
            });
            if (!payment) throw new NotFoundException('Payment not found');

            const client = payment.client;
            await manager.remove(Payment, payment);

            // Recalculate sale status
            if (client.saleTotalAmount) {
                const allPayments = await manager.find(Payment, { where: { clientId: client.id } });
                const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

                if (totalPaid >= client.saleTotalAmount) {
                    client.saleStatus = SaleStatus.FULL;
                } else {
                    client.saleStatus = SaleStatus.PARTIAL;
                }
                await manager.save(client);
            }

            // Fetch fully populated client for gateway emission
            const updatedClient = await manager.findOne(Client, {
                where: { id: client.id },
                relations: { department: true, notes: true, payments: true }
            });

            this.clientsGateway.emitClientUpdate(client.id, updatedClient);

            await manager.save(ActivityLog, {
                userId: user.id || undefined,
                actionType: 'CLIENT_PAYMENT_DELETED',
                details: { clientId: client.id, amount: payment.amount, paymentId }
            });
        });
    }

    async setSale(clientId: string, dto: SetSaleDto, user?: AuthenticatedUser): Promise<Client> {
        const client = await this.findOne(clientId);
        client.saleStatus = dto.status;
        if (dto.totalAmount !== undefined) client.saleTotalAmount = dto.totalAmount;
        if (dto.additionalPrice !== undefined) client.saleAdditionalPrice = dto.additionalPrice;
        if (dto.nextPaymentAt !== undefined) {
            client.nextPaymentAt = dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null;
        }
        if (dto.status !== SaleStatus.NONE) {
            client.soldByEmployeeId = user?.id || null;
            client.soldAt = new Date();
            client.stage = ClientStage.SOLD;
            client.inCallByEmployeeId = null;
            client.inCallByName = null;
            client.callStartedAt = null;
            if (user) {
                client.soldByName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phoneNumber;
            }
        }

        if (dto.telegramId) {
            client.telegramId = dto.telegramId;
        }

        const saved = await this.clientRepo.save(client);

        this.clientsGateway.emitClientUpdate(client.id, saved);

        // Automated welcome message for partial sales
        if (dto.status === SaleStatus.PARTIAL && dto.telegramId) {
            const welcomeMessage = `Assalomu alaykum! Hurmatli mijoz!\n\nQolgan muddat davomida ushbu bot orqali sizga to‘lov sanasi yaqinlashayotgani haqida muntazam ravishda eslatmalar yuborib boriladi.`;
            this.telegramService.sendMessage([dto.telegramId], welcomeMessage)
                .catch(err => this.logger.error(`Failed to send welcome message to client ${client.id}: ${err.message}`));
        }

        if (dto.paidAmount && dto.paidAmount > 0 && user) {
            await this.addPayment(clientId, { amount: dto.paidAmount }, user);
        }

        await this.activityRepo.save({
            actionType: 'CLIENT_SALE_UPDATED',
            details: { clientId, status: saved.saleStatus, totalAmount: saved.saleTotalAmount }
        });

        // Notify ALL users (async)
        this.getAllUserIds().then(userIds => {
            const otherUserIds = userIds.filter(id => user ? id !== user.id : true);
            if (otherUserIds.length > 0) {
                const statusLabels: Record<string, string> = {
                    full: "to'liq",
                    partial: "bo'lib to'lash (nasiya)",
                    none: "bekor qilindi",
                };
                const statusLabel = statusLabels[saved.saleStatus] || saved.saleStatus;

                this.notificationsService.createBatchNotifications(
                    otherUserIds,
                    NotificationType.CLIENT_PAYMENT,
                    `💳 Mijoz "${saved.fullName}" sotuv holati yangilandi: ${statusLabel}`,
                    { clientId, status: saved.saleStatus },
                    { skipTelegram: true }
                ).catch(err => this.logger.error('Batch sale notification failed', err));
            }
        });

        return saved;
    }

    /**
     * Helper: get all user IDs to notify (director + all employees).
     */
    private async getAllUserIds(): Promise<string[]> {
        const users = await this.userRepo.find({ select: ['id'] });
        return users.map(u => u.id);
    }

    private async getDirectorIds(): Promise<string[]> {
        const directors = await this.userRepo.find({
            where: { role: UserRole.DIRECTOR },
            select: ['id']
        });
        return directors.map(d => d.id);
    }

    private isAllowedTime(): boolean {
        const now = dayjs().tz('Asia/Tashkent');
        const hour = now.hour();
        return hour >= 9 && hour < 21;
    }

    @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'Asia/Tashkent' })
    async handleReminders() {
        const now = dayjs().tz('Asia/Tashkent').toDate();

        // 1. Call Reminders (remindAt)
        const callReminders = await this.clientRepo.find({
            where: {
                remindAt: LessThanOrEqual(now),
            }
        });

        if (callReminders.length > 0) {
            for (const client of callReminders) {
                this.clientsGateway.emitReminder(client.id, client.fullName);

                const message = `🔔 "${client.fullName}" bilan bog'lanish vaqti keldi. Qayta qo'ng'iroq qiling.`;

                const userIdsToNotify = await this.getAllUserIds();
                if (userIdsToNotify.length > 0) {
                    await this.notificationsService.createBatchNotifications(
                        userIdsToNotify,
                        NotificationType.CLIENT_REMINDER,
                        message,
                        { clientId: client.id },
                        { skipTelegram: true }
                    );
                }

                client.remindAt = null;
                client.remindEmployeeId = null;
                await this.clientRepo.save(client);
            }
        }

        // 2. Payment Reminders (nextPaymentAt)
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        const paymentReminders = await this.clientRepo.find({
            where: [
                {
                    saleStatus: SaleStatus.PARTIAL,
                    nextPaymentAt: LessThanOrEqual(now),
                    lastPaymentNotifiedAt: IsNull()
                },
                {
                    saleStatus: SaleStatus.PARTIAL,
                    nextPaymentAt: LessThanOrEqual(now),
                    lastPaymentNotifiedAt: LessThanOrEqual(fourHoursAgo)
                }
            ]
        });

        if (paymentReminders.length > 0) {
            for (const client of paymentReminders) {
                this.clientsGateway.emitPaymentReminder(client.id, client.fullName);

                const isFirstNotification = !client.lastPaymentNotifiedAt;
                const message = isFirstNotification
                    ? `💰 "${client.fullName}" uchun to'lov muddati keldi.`
                    : `💸 "${client.fullName}" uchun kutilayotgan to'lov hali amalga oshirilmadi.`;

                const userIdsToNotify = await this.getAllUserIds();
                if (userIdsToNotify.length > 0) {
                    try {
                        // Web/Socket notifications always sent every 4 hours
                        await this.notificationsService.createBatchNotifications(
                            userIdsToNotify,
                            NotificationType.CLIENT_PAYMENT,
                            message,
                            { clientId: client.id, clientName: client.fullName },
                            { skipTelegram: true }
                        );
                    } catch (err) {
                        this.logger.error(`Failed to notify for payment reminder: ${err.message}`);
                    }
                }

                // Telegram notifications for clients: every 4 hours AND only 9 AM - 9 PM
                if (client.telegramId && this.isAllowedTime()) {
                    try {
                        const clientMessage = `🔔 <b>Hurmatli ${client.fullName},</b>\n\n"Tourland" dan to'lov muddati kelganini eslatib o'tamiz. Iltimos, o'z vaqtida amalga oshiring.`;
                        await this.telegramService.sendMessage([client.telegramId], clientMessage);
                    } catch (err) {
                        this.logger.error(`Failed to send automated Telegram reminder to client ${client.id}: ${err.message}`);
                    }
                }

                client.lastPaymentNotifiedAt = now;
                await this.clientRepo.save(client);
            }
        }

        // 3. Persistent "Ko'tarmadi" (No Answer) Reminders
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const noAnswerReminders = await this.clientRepo.find({
            where: [
                {
                    stage: ClientStage.NO_ANSWER,
                    lastCallReminderNotifiedAt: IsNull(),
                    updatedAt: LessThanOrEqual(oneHourAgo)
                },
                {
                    stage: ClientStage.NO_ANSWER,
                    lastCallReminderNotifiedAt: LessThanOrEqual(oneHourAgo)
                }
            ]
        });

        if (noAnswerReminders.length > 0) {
            for (const client of noAnswerReminders) {
                const message = `⏳ "${client.fullName}" ko'tarmadi. Iltimos, yana bir bor bog'lanishga harakat qiling.`;

                const userIdsToNotify = await this.getAllUserIds();
                if (userIdsToNotify.length > 0) {
                    try {
                        await this.notificationsService.createBatchNotifications(
                            userIdsToNotify,
                            NotificationType.CLIENT_REMINDER,
                            message,
                            { clientId: client.id, type: 'persistent_reminder' },
                            { skipTelegram: true }
                        );

                        client.lastCallReminderNotifiedAt = now;
                        await this.clientRepo.save(client);
                    } catch (err) {
                        this.logger.error(`Failed to notify for persistent no-answer reminder: ${err.message}`);
                    }
                } else {
                    this.logger.warn(`No target found for persistent reminder on client ${client.id}`);
                    client.lastCallReminderNotifiedAt = now;
                    await this.clientRepo.save(client);
                }
            }
        }
    }

    async importFromExcel(
        fileBuffer: Buffer,
        departmentId: string,
    ): Promise<{ imported: number; skipped: number; total: number }> {
        // Verify department exists
        const department = await this.departmentRepo.findOne({ where: { id: departmentId } });
        if (!department) throw new BadRequestException('Department not found');

        // Parse workbook
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new BadRequestException('Excel file is empty');

        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
        if (rows.length === 0) throw new BadRequestException('No data rows found in the Excel file');

        // Flexible header mapping
        const NAME_KEYS = ['fullname', 'full_name', 'ism', 'ism familya', 'ism familiya', 'name', 'familya', 'f.i.o', 'fio', 'fish'];
        const PHONE_KEYS = ['phonenumber', 'phone_number', 'phone', 'telefon', 'tel', 'tel raqam', 'raqam', 'number'];

        const findKey = (row: Record<string, any>, candidates: string[]): string | undefined => {
            const rowKeys = Object.keys(row);
            return rowKeys.find(k => candidates.includes(k.toLowerCase().trim()));
        };

        const firstRow = rows[0];
        const nameKey = findKey(firstRow, NAME_KEYS);
        const phoneKey = findKey(firstRow, PHONE_KEYS);

        if (!nameKey) throw new BadRequestException("Column for name not found. Supported headers: " + NAME_KEYS.join(', '));
        if (!phoneKey) throw new BadRequestException("Column for phone not found. Supported headers: " + PHONE_KEYS.join(', '));

        // Extract and clean data
        const parsed = rows
            .map(row => ({
                fullName: String(row[nameKey] || '').trim(),
                phoneNumber: String(row[phoneKey] || '').replace(/\s+/g, '').trim(),
            }))
            .filter(r => r.fullName && r.phoneNumber);

        if (parsed.length === 0) throw new BadRequestException('No valid rows with name and phone found');

        // Get all existing phone numbers in one query
        const allPhones = parsed.map(r => r.phoneNumber);
        const existingClients = await this.clientRepo
            .createQueryBuilder('c')
            .select('c.phoneNumber')
            .where('c.phoneNumber IN (:...phones)', { phones: allPhones })
            .getMany();

        const existingPhones = new Set(existingClients.map(c => c.phoneNumber));

        // Filter out duplicates
        const newClients = parsed.filter(r => !existingPhones.has(r.phoneNumber));

        // Also deduplicate within the file itself
        const seen = new Set<string>();
        const uniqueNewClients = newClients.filter(r => {
            if (seen.has(r.phoneNumber)) return false;
            seen.add(r.phoneNumber);
            return true;
        });

        // Bulk insert
        if (uniqueNewClients.length > 0) {
            const entities = uniqueNewClients.map(r =>
                this.clientRepo.create({
                    fullName: r.fullName,
                    phoneNumber: r.phoneNumber,
                    departmentId: department.id,
                }),
            );
            await this.clientRepo.save(entities);
        }

        return {
            imported: uniqueNewClients.length,
            skipped: parsed.length - uniqueNewClients.length,
            total: parsed.length,
        };
    }
}