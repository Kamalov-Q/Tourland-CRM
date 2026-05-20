import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { FormTemplate } from './entities/form-template.entity';
import { FormField } from './entities/form-field.entity';
import { ActivityLog } from '../archive/entities/activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormTemplate, FormField, ActivityLog])],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
