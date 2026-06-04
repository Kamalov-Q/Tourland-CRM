import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramUser } from './entities/telegram-user.entity';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ToursModule } from '../tours/tours.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramUser, User, Client, Notification]),
    ToursModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule { }
