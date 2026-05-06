import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ClientsModule } from './modules/clients/clients.module';

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
    AuthModule,
    UsersModule,
    TasksModule,
    DepartmentsModule,
    ClientsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
