import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FormTemplate } from './form-template.entity';
import { FormFieldType } from '../enums/form-field-type.enum';

@Entity('form_fields')
export class FormField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  formId: string;

  @Column({
    type: 'enum',
    enum: FormFieldType,
  })
  type: FormFieldType;

  @Column()
  label: string;

  @Column({ default: false })
  required: boolean;

  @Column({ type: 'simple-array', nullable: true })
  options: string[];

  @Column({ default: 0 })
  order: number;

  @ManyToOne('FormTemplate', 'fields', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: FormTemplate;
}
