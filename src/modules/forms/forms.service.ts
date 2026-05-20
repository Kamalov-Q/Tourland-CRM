import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FormTemplate } from './entities/form-template.entity';
import { FormField } from './entities/form-field.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { ActivityLog } from '../archive/entities/activity-log.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(FormTemplate)
    private readonly formRepo: Repository<FormTemplate>,
    @InjectRepository(FormField)
    private readonly fieldRepo: Repository<FormField>,
    @InjectRepository(ActivityLog)
    private readonly activityRepo: Repository<ActivityLog>,
    private readonly dataSource: DataSource,
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

    // Dynamically find fullName and phone fields by common label patterns
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

      await manager.save(ActivityLog, {
        actionType: 'CLIENT_CREATED',
        details: { clientId: savedClient.id, fullName: savedClient.fullName, source: form.title }
      });

      return savedClient;
    });
  }
}
