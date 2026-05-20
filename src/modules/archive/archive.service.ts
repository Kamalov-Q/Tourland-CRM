import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ArchiveService {
    constructor(
        @InjectRepository(ActivityLog)
        private readonly activityRepo: Repository<ActivityLog>,
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>
    ) {}

    async getDirectorArchive(directorId: string) {
        const employees = await this.usersRepo.find({
            where: { parentId: directorId }
        });
        
        const userIds = [directorId, ...employees.map(e => e.id)];

        const [withUser, withoutUser] = await Promise.all([
            this.activityRepo.find({
                where: { userId: In(userIds) },
                relations: ['user'],
                order: { createdAt: 'DESC' }
            }),
            this.activityRepo.find({
                where: { userId: IsNull() },
                order: { createdAt: 'DESC' }
            }),
        ]);

        return [...withUser, ...withoutUser].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    async getEmployeeArchive(employeeId: string) {
        return this.activityRepo.find({
            where: {
                userId: employeeId
            },
            relations: ['user'],
            order: {
                createdAt: 'DESC'
            }
        });
    }
}
