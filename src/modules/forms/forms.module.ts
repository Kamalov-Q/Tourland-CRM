import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { FormTemplate } from './entities/form-template.entity';
import { FormField } from './entities/form-field.entity';
import { ActivityLog } from '../archive/entities/activity-log.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormTemplate, FormField, ActivityLog, User]),
    NotificationsModule,
    ClientsModule
  ],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
