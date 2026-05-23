import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TaskTemplate } from "./entities/task-template.entity";
import { DataSource, Repository, LessThan, In, LessThanOrEqual } from "typeorm";
import { TaskInstance } from "./entities/task-instance.entity";
import { TaskStatusHistory } from "./entities/task-status-history.entity";
import { Notification } from "./entities/notification.entity";
import { NotificationGateway } from "./gateways/notification.gateway";
import { CreateTaskTemplateDto } from "./dto/create-task-template.dto";
import { TaskStatus } from "./enums/task-status.enum";
import { NotificationType } from "./enums/notification-type.enum";
import { User, UserRole } from "../users/entities/user.entity";
import { ActivityLog } from "../archive/entities/activity-log.entity";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class TasksService {

    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,

        @InjectRepository(TaskTemplate)
        private readonly templateRepo: Repository<TaskTemplate>,

        @InjectRepository(TaskInstance)
        private readonly taskRepo: Repository<TaskInstance>,

        @InjectRepository(TaskStatusHistory)
        private readonly historyRepo: Repository<TaskStatusHistory>,

        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        
        @InjectRepository(ActivityLog)
        private readonly activityRepo: Repository<ActivityLog>,

        private gateway: NotificationGateway,

        private dataSource: DataSource,

        @InjectQueue('task-queue')
        private readonly taskQueue: Queue
    ) { }

    // Create Template
    async createTemplate(
        dto: CreateTaskTemplateDto,
        directorId: string
    ) {

        const director = await this.usersRepo.findOne({
            where: { id: directorId }
        });

        if (!director?.isActive) {
            throw new UnauthorizedException('Inactive director');
        }

        const employee = await this.usersRepo.findOne({
            where: { id: dto.assignedTo }
        });

        if (!employee?.isActive) {
            throw new BadRequestException('Employee is inactive');
        }

        const start = new Date(dto.startDate);

        const end = new Date(dto.endDate);

        if (end < start) {
            throw new BadRequestException('Invalid date range');
        }

        const template = this.templateRepo.create({
            title: dto.title,
            description: dto.description,
            assignedTo: dto.assignedTo,
            createdBy: directorId,
            notifyAt: dto.notifyAt,
            startDate: dto.startDate,
            endDate: dto.endDate
        });

        const saved = await this.templateRepo.save(template);

        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
        const todayDate = new Date(`${tzDateStr}T00:00:00.000Z`);

        const startDay = new Date(`${dto.startDate}T00:00:00.000Z`);
        const endDay = new Date(`${dto.endDate}T23:59:59.999Z`);
        
        const todayStart = new Date(`${tzDateStr}T00:00:00.000Z`);

        let currentDay = new Date(startDay);
        const instancesToCreate: any[] = [];
        while (currentDay <= endDay) {
            const dateStr = currentDay.toISOString().split('T')[0];
            const tempStart = new Date(`${dateStr}T00:00:00.000Z`);
            const expires = new Date(`${dateStr}T23:59:59.999Z`);

            instancesToCreate.push({
                templateId: saved.id,
                assignedTo: saved.assignedTo,
                dueDate: tempStart,
                expiresAt: expires,
                status: TaskStatus.TODO
            });
            currentDay.setUTCDate(currentDay.getUTCDate() + 1);
        }
        const instances = this.taskRepo.create(instancesToCreate);
        await this.taskRepo.save(instances);

        if (todayDate >= startDay && todayDate <= endDay) {
            const isToday = todayStart.getTime() === startDay.getTime();
            const currentTime = todayDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
            
            if (!isToday || currentTime >= dto.notifyAt) {
                await this.taskQueue.add(
                    'generate-task',
                    { templateId: saved.id, isCron: false, isCreation: true },
                    { attempts: 3 }
                );
            }
        }

        return saved;
    }

    async findOne(id: string) {
        const task = await this.taskRepo.findOne({
            where: { id },
            relations: ['template'],
        });
        if (!task) throw new NotFoundException('Task not found');
        return task;
    }

    // Update task status
    async updateTaskStatus(
        taskId: string,
        newStatus: TaskStatus,
        userId: string,
        completionDescription?: string,
        completionLink?: string,
    ) {

        const user = await this.usersRepo.findOne({
            where: {
                id: userId
            }
        });

        if (!user?.isActive) {
            throw new UnauthorizedException('Inactive user');
        }

        return this.dataSource.transaction(
            async manager => {
                const task = await manager.findOne(TaskInstance, {
                    where: {
                        id: taskId
                    },
                    relations: [
                        'template',
                    ]
                });

                if (!task) {
                    throw new NotFoundException('Task not found');
                }

                const oldStatus = task.status;

                // === Terminal state check ===
                // Once DONE (approved) or INCOMPLETE (cron at 11:59 PM), the task cannot be changed
                if (oldStatus === TaskStatus.DONE || oldStatus === TaskStatus.INCOMPLETE) {
                    throw new BadRequestException('Task is already finalized and cannot be changed');
                }

                // Employee cannot set DONE directly – director must approve
                if (newStatus === TaskStatus.DONE) {
                    throw new BadRequestException('Director verification required');
                }

                if (user.role === UserRole.EMPLOYEE) {
                    if (newStatus !== TaskStatus.IN_PROGRESS && newStatus !== TaskStatus.PENDING) {
                        throw new BadRequestException('Employee can only set task to in_progress or pending');
                    }
                }

                // To submit (PENDING), the task must have been started or was previously rejected
                if (newStatus === TaskStatus.PENDING) {
                    if (task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.REJECTED) {
                        throw new BadRequestException('Task must be in progress or rejected to submit');
                    }
                }

                task.status = newStatus;

                if (newStatus === TaskStatus.PENDING) {
                    task.completionDescription = completionDescription;
                    task.completionLink = completionLink;
                    task.completedAt = new Date();
                }

                await manager.save(task);

                // History
                const history = manager.create(TaskStatusHistory, {
                    taskId: task.id,
                    oldStatus,
                    newStatus,
                    changedBy: userId
                });

                await manager.save(history);

                await manager.save(ActivityLog, {
                    userId,
                    actionType: 'TASK_STATUS_CHANGED',
                    details: {
                        taskId: task.id,
                        title: task.template?.title,
                        oldStatus,
                        newStatus
                    }
                });

                // Notification & Socket
                const notifyUserId = userId === task.assignedTo ? task.template.createdBy : task.assignedTo;

                await manager.save(Notification, {
                    userId: notifyUserId,
                    type: NotificationType.TASK_STATUS_CHANGED,
                    message: `Task status changed to ${newStatus}`
                });

                this.gateway.emitTaskStatusChanged(notifyUserId, {
                    taskId: task.id,
                    oldStatus,
                    newStatus,
                    changedBy: userId,
                    changedAt: history.changedAt
                });

                return task;
            }
        )
    }

    // Verify task
    async verifyTask(
        taskId: string,
        directorId: string
    ) {
        const director = await this.usersRepo.findOne({
            where: { id: directorId }
        });

        if (!director?.isActive) {
            throw new UnauthorizedException('Inactive director');
        }

        return this.dataSource.transaction(async manager => {
            const task = await manager.findOne(TaskInstance, {
                where: {
                    id: taskId
                },
                relations: ['template']
            });

            if (!task) {
                throw new NotFoundException('Task not found');
            }

            if (task.status !== TaskStatus.PENDING) {
                throw new BadRequestException('Task is not pending verification');
            }

            const oldStatus = task.status;

            task.status = TaskStatus.DONE;
            task.approvedAt = new Date();

            await manager.save(task);

            // History
            const history = manager.create(TaskStatusHistory, {
                taskId: task.id,
                oldStatus,
                newStatus: TaskStatus.DONE,
                changedBy: directorId
            });

            await manager.save(history);

            await manager.save(ActivityLog, {
                userId: directorId,
                actionType: 'TASK_VERIFIED',
                details: {
                    taskId: task.id,
                    title: task.template?.title,
                    status: TaskStatus.DONE
                }
            });

            // Notification
            await manager.save(Notification, {
                userId: task.assignedTo,
                type: NotificationType.TASK_VERIFIED,
                message: `Task verified by director`
            });


            // Socket event
            this.gateway.emitTaskVerified(task.assignedTo, {
                taskId: task.id,
                status: TaskStatus.DONE
            });

            return task;

        });
    }

    // Reject task
    async rejectTask(
        taskId: string,
        directorId: string,
        reason?: string,
    ) {
        return this.dataSource.transaction(async manager => {
            const task = await manager.findOne(TaskInstance, {
                where: {
                    id: taskId,
                },
                relations: [
                    'template'
                ],
            });

            if (!task) {
                throw new NotFoundException('Task not found');
            }

            const oldStatus = task.status;

            task.status = TaskStatus.REJECTED;
            task.rejectionReason = reason;
            task.approvedAt = new Date();

            await manager.save(task);

            // History
            const history = manager.create(TaskStatusHistory, {
                taskId: task.id,
                oldStatus,
                newStatus: TaskStatus.REJECTED,
                changedBy: directorId
            });

            await manager.save(history);

            await manager.save(ActivityLog, {
                userId: directorId,
                actionType: 'TASK_REJECTED',
                details: {
                    taskId: task.id,
                    title: task.template?.title,
                    status: TaskStatus.REJECTED
                }
            });

            // NOtification
            await manager.save(Notification, {
                userId: task.assignedTo,
                type: NotificationType.TASK_REJECTED,
                message: `Task rejected by director`
            });

            // Socket
            this.gateway.emitTaskStatusChanged(task.assignedTo, {
                taskId: task.id,
                status: TaskStatus.REJECTED
            });

            return task;
        });
    }

    // History 
    async getTaskHistory(taskId: string) {
        return this.historyRepo.find({
            where: {
                taskId,
            },
            order: {
                changedAt: 'ASC'
            }
        });
    }

    async markPastTasksIncomplete() {
        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
        const today = new Date(`${tzDateStr}T00:00:00.000Z`);

        const expired = await this.taskRepo.find({
            where: {
                dueDate: LessThan(today),
                status: In([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REJECTED])
            }
        });

        for (const task of expired) {
            await this.taskQueue.add('mark-incomplete', { taskId: task.id }, { attempts: 2 });
            task.status = TaskStatus.INCOMPLETE;
        }
    }

    // Employee Tasks
    async getEmployeeTasks(employeeId: string) {
        await this.markPastTasksIncomplete();

        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
        const today = new Date(`${tzDateStr}T00:00:00.000Z`);

        const tasks = await this.taskRepo.find({
            where: {
                assignedTo: employeeId,
                dueDate: LessThanOrEqual(today)
            },
            relations: ['template'],
            order: {
                dueDate: 'DESC'
            }
        });

        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });

        return tasks.filter(t => {
            const taskD = new Date(t.dueDate);
            const isToday = taskD.getTime() === today.getTime();
            if (isToday) {
                if (t.template?.notifyAt && t.template.notifyAt > currentTime) {
                    return false;
                }
            }
            return true;
        });
    }

    // Director dashboard
    async getDirectorDashboard(directorId: string) {
        await this.markPastTasksIncomplete();

        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
        const today = new Date(`${tzDateStr}T00:00:00.000Z`);

        return this.taskRepo.find({
            relations: ['template'],
            where: {
                template: {
                    createdBy: directorId,
                },
                dueDate: LessThanOrEqual(today)
            },
            order: {
                createdAt: 'DESC'
            }
        })
    }

    // Get all instances for a template
    async getTemplateInstances(templateId: string) {
        return this.taskRepo.find({
            where: { templateId },
            order: { dueDate: 'ASC' }
        });
    }
}