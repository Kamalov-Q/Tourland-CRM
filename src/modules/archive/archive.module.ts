import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { ActivityLog } from './entities/activity-log.entity';
import { User } from '../users/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ActivityLog, User])],
    controllers: [ArchiveController],
    providers: [ArchiveService],
    exports: [ArchiveService]
})
export class ArchiveModule {}
