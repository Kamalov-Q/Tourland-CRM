import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
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
import { User } from '../users/entities/user.entity';

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

        private readonly dataSource: DataSource,
    ) { }

    async create(dto: CreateClientDto): Promise<Client> {
        const department = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
        if (!department) throw new BadRequestException('Department not found');

        const client = this.clientRepo.create({
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            description: dto.description ?? null,
            departmentId: department.id,
        });

        const saved = await this.clientRepo.save(client);

        this.clientsGateway.emitClientUpdate(saved.id, saved);

        await this.activityRepo.save({
            actionType: 'CLIENT_CREATED',
            details: { clientId: saved.id, fullName: saved.fullName }
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

    async update(id: string, dto: UpdateClientDto): Promise<Client> {
        const client = await this.findOne(id);
        if (dto.departmentId && dto.departmentId !== client.departmentId) {
            const dep = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
            if (!dep) throw new BadRequestException('Department not found');
        }
        Object.assign(client, dto);

        // If the stage is changing away from NEW/IN_PROGRESS, we typically end the call, but let's clear call fields if stage goes to NO_ANSWER, TALKED, or SOLD
        if (dto.stage && dto.stage !== ClientStage.NEW) {
            client.inCallByEmployeeId = null;
            client.inCallByName = null;
            client.callStartedAt = null;
            this.clientsGateway.emitCallEnded(client.id);
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
            client.soldAt = new Date();
            client.stage = ClientStage.SOLD;
            client.inCallByEmployeeId = null;
            client.inCallByName = null;
            client.callStartedAt = null;
            if (user) {
                client.soldByName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phoneNumber;
            }
        }

        const saved = await this.clientRepo.save(client);

        this.clientsGateway.emitClientUpdate(client.id, saved);

        if (dto.paidAmount && dto.paidAmount > 0 && user) {
            await this.addPayment(clientId, { amount: dto.paidAmount }, user);
        }

        await this.activityRepo.save({
            actionType: 'CLIENT_SALE_UPDATED',
            details: { clientId, status: saved.saleStatus, totalAmount: saved.saleTotalAmount }
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

    @Cron(CronExpression.EVERY_MINUTE)
    async handleReminders() {
        const now = new Date();

        // 1. Call Reminders (remindAt)
        const callReminders = await this.clientRepo.find({
            where: {
                remindAt: LessThanOrEqual(now),
            }
        });

        for (const client of callReminders) {
            this.clientsGateway.emitReminder(client.id, client.fullName);

            // Notify the in-call employee specifically
            if (client.inCallByEmployeeId) {
                await this.notificationsService.createNotification(
                    client.inCallByEmployeeId,
                    NotificationType.CLIENT_REMINDER,
                    `Mijoz ${client.fullName} uchun eslatma vaqti keldi`,
                    { clientId: client.id }
                );
            }

            client.remindAt = null;
            await this.clientRepo.save(client);
        }

        // 2. Payment Reminders (nextPaymentAt)
        // Notify every 10 minutes if unpaid
        const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
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
                    lastPaymentNotifiedAt: LessThanOrEqual(tenMinsAgo)
                }
            ]
        });

        if (paymentReminders.length > 0) {
            // Fetch all user IDs once for broadcasting
            const allUserIds = await this.getAllUserIds();

            for (const client of paymentReminders) {
                // Broadcast socket event to everyone
                this.clientsGateway.emitPaymentReminder(client.id, client.fullName);

                const isFirstNotification = !client.lastPaymentNotifiedAt;
                const message = isFirstNotification
                    ? `Mijoz ${client.fullName} uchun to'lov vaqti keldi`
                    : `Mijoz ${client.fullName} uchun to'lov hali amalga oshirilmagan`;

                // Send persistent notification to ALL users (director + employees)
                for (const userId of allUserIds) {
                    try {
                        await this.notificationsService.createNotification(
                            userId,
                            NotificationType.CLIENT_PAYMENT,
                            message,
                            { clientId: client.id, clientName: client.fullName }
                        );
                    } catch (err) {
                        this.logger.error(`Failed to notify user ${userId} for payment reminder: ${err.message}`);
                    }
                }

                client.lastPaymentNotifiedAt = now;
                await this.clientRepo.save(client);
            }
        }
    }
}