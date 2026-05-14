import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { FormTemplate } from './entities/form-template.entity';
import { FormField } from './entities/form-field.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormTemplate, FormField])],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
