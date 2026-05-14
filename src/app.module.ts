import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ClientsModule } from './modules/clients/clients.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { FormsModule } from './modules/forms/forms.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true
  }),
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configSvc: ConfigService) => ({
      type: 'postgres',
      host: configSvc.getOrThrow<string>('DATABASE_HOST'),
      port: Number(configSvc.getOrThrow<string>('DATABASE_PORT')),
      username: configSvc.getOrThrow<string>('DATABASE_USERNAME'),
      password: configSvc.getOrThrow<string>('DATABASE_PASSWORD'),
      database: configSvc.getOrThrow<string>('DATABASE_NAME'),
      autoLoadEntities: true,
      // TODO: Later in production set it to NODE_ENV !== 'production'
      synchronize: true
    })
  }),
  BullModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configSvc: ConfigService) => ({
      connection: {
        host: configSvc.get<string>('REDIS_HOST', 'localhost'),
        port: configSvc.get<number>('REDIS_PORT', 6379),
      }
    }),
  }),

  // Cron
  ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    TasksModule,
    DepartmentsModule,
    ClientsModule,
    AttendanceModule,
    ArchiveModule,
    FormsModule,
    HealthModule,
  ServeStaticModule.forRoot({
    rootPath: join(process.cwd(), 'uploads'),
    serveRoot: '/uploads',
  }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
