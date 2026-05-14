import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class ClientsService {
    constructor(
        @InjectRepository(Client)
        private readonly clientRepo: Repository<Client>,

        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,

        @InjectRepository(ClientNote)
        private readonly noteRepo: Repository<ClientNote>,

        @InjectRepository(Payment)
        private readonly paymentRepo: Repository<Payment>,

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

        return this.clientRepo.save(client);
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
        return this.clientRepo.save(client);
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
        return this.noteRepo.save(note);
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

            return saved;
        });
    }

    async setSale(clientId: string, dto: SetSaleDto): Promise<Client> {
        const client = await this.findOne(clientId);
        client.saleStatus = dto.status;
        if (dto.totalAmount !== undefined) client.saleTotalAmount = dto.totalAmount;
        if (dto.nextPaymentAt !== undefined) {
            client.nextPaymentAt = dto.nextPaymentAt ? new Date(dto.nextPaymentAt) : null;
        }
        if (dto.status !== SaleStatus.NONE) {
            client.soldAt = new Date();
            client.stage = ClientStage.SOLD;
        }
        return this.clientRepo.save(client);
    }
}