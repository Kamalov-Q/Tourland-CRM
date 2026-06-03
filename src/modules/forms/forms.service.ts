import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FormTemplate } from './entities/form-template.entity';
import { FormField } from './entities/form-field.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { ActivityLog } from '../archive/entities/activity-log.entity';
import { Client } from '../clients/entities/client.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { User, UserRole } from '../users/entities/user.entity';
import { ClientsGateway } from '../clients/gateways/clients.gateway';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(FormTemplate)
    private readonly formRepo: Repository<FormTemplate>,
    @InjectRepository(FormField)
    private readonly fieldRepo: Repository<FormField>,
    @InjectRepository(ActivityLog)
    private readonly activityRepo: Repository<ActivityLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly clientsGateway: ClientsGateway,
  ) { }

  async create(dto: CreateFormDto) {
    const form = this.formRepo.create({
      title: dto.title,
      targetDepartmentId: dto.targetDepartmentId,
      fields: dto.fields.map((f, i) =>
        this.fieldRepo.create({
          ...f,
          order: i,
        }),
      ),
    });
    const saved = await this.formRepo.save(form);

    await this.activityRepo.save({
      actionType: 'FORM_CREATED',
      details: { formId: saved.id, title: saved.title, departmentId: saved.targetDepartmentId }
    });

    // Notify directors (async)
    this.getDirectorIds().then(directorIds => {
      for (const dirId of directorIds) {
        this.notificationsService.createNotification(
          dirId,
          NotificationType.FORM_UPDATE,
          `📄 Yangi forma yaratildi: "${saved.title}"`,
          { formId: saved.id }
        ).catch(err => console.error('Notification failed', err));
      }
    });

    return saved;
  }

  findAll() {
    return this.formRepo.find({
      relations: ['fields'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const form = await this.formRepo.findOne({
      where: { id },
      relations: ['fields'],
    });
    if (!form) throw new NotFoundException('Form not found');

    // Sort fields by order
    form.fields.sort((a, b) => a.order - b.order);
    return form;
  }

  async update(id: string, dto: CreateFormDto) {
    const form = await this.findOne(id);

    return this.dataSource.transaction(async (manager) => {
      // Delete existing fields
      await manager.delete(FormField, { formId: id });

      // Update template and create new fields
      form.title = dto.title;
      form.targetDepartmentId = dto.targetDepartmentId;
      form.fields = dto.fields.map((f, i) =>
        manager.create(FormField, {
          ...f,
          order: i,
          formId: id,
        }),
      );

      const saved = await manager.save(form);

      await manager.save(ActivityLog, {
        actionType: 'FORM_UPDATED',
        details: { formId: saved.id, title: saved.title }
      });

      // Notify directors (async)
      this.getDirectorIds().then(directorIds => {
        for (const dirId of directorIds) {
          this.notificationsService.createNotification(
            dirId,
            NotificationType.FORM_UPDATE,
            `📝 Forma tahrirlandi: "${saved.title}"`,
            { formId: saved.id }
          ).catch(err => console.error('Notification failed', err));
        }
      });

      return saved;
    });
  }

  async remove(id: string) {
    const result = await this.formRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Form not found');
    return { success: true };
  }

  async submitForm(id: string, data: Record<string, any>) {
    const form = await this.findOne(id);
    
    const nameField = form.fields.find(f =>
      /name|ism|familya/i.test(f.label)
    );
    const phoneField = form.fields.find(f =>
      /phone|tel|raqam/i.test(f.label)
    );

    const fullName = (nameField && data[nameField.label]) || 'Guest';
    const phoneNumber = (phoneField && data[phoneField.label]) || '';

    return this.dataSource.transaction(async (manager) => {
      const client = manager.create(Client, {
        fullName,
        phoneNumber,
        description: `Submitted via form: ${form.title}`,
        departmentId: form.targetDepartmentId,
        data,
      });
      const savedClient = await manager.save(client);

      this.clientsGateway.emitClientUpdate(savedClient.id, savedClient);

      await manager.save(ActivityLog, {
        actionType: 'CLIENT_CREATED',
        details: { clientId: savedClient.id, fullName: savedClient.fullName, source: form.title }
      });

      // Notify ALL users (async)
      this.getAllUserIds().then(userIds => {
        for (const userId of userIds) {
          this.notificationsService.createNotification(
            userId,
            NotificationType.FORM_UPDATE,
            `Yangi ariza kelib tushdi: "${form.title}" (Mijoz: ${savedClient.fullName})`,
            { clientId: savedClient.id }
          ).catch(err => console.error('Notification failed', err));
        }
      });

      return savedClient;
    });
  }

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
}
