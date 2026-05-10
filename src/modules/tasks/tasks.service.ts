import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TaskTemplate } from "./entities/task-template.entity";
import { DataSource, Repository } from "typeorm";
import { TaskInstance } from "./entities/task-instance.entity";
import { TaskStatusHistory } from "./entities/task-status-history.entity";
import { Notification } from "./entities/notification.entity";
import { NotificationGateway } from "./gateways/notification.gateway";
import { CreateTaskTemplateDto } from "./dto/create-task-template.dto";
import { TaskStatus } from "./enums/task-status.enum";
import { NotificationType } from "./enums/notification-type.enum";
import { User } from "../users/entities/user.entity";

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

        private gateway: NotificationGateway,

        private dataSource: DataSource
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

        return this.templateRepo.save(template);
    }

    // Update task status
    async updateTaskStatus(
        taskId: string,
        newStatus: TaskStatus,
        userId: string
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

                // Validations
                //employee cannot directly set DONE
                if (newStatus === TaskStatus.DONE) {
                    throw new BadRequestException('Director verification required');
                }

                // Must start first
                if (newStatus === TaskStatus.PENDING) {
                    if (task.status !== TaskStatus.IN_PROGRESS) {
                        throw new BadRequestException('Task must be in progress first');
                    }
                }

                task.status = newStatus;

                await manager.save(task);

                // History
                const history = manager.create(TaskStatusHistory, {
                    taskId: task.id,
                    oldStatus,
                    newStatus,
                    changedBy: userId
                });

                await manager.save(history);

                // Notification
                await manager.save(Notification, {
                    userId: task.template.createdBy,
                    type: NotificationType.TASK_STATUS_CHANGED,
                    message: `Task status changed to ${newStatus}`
                });

                // Socket event
                this.gateway.emitTaskStatusChanged(task.template.createdBy, {
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

            await manager.save(task);

            // History
            const history = manager.create(TaskStatusHistory, {
                taskId: task.id,
                oldStatus,
                newStatus: TaskStatus.DONE,
                changedBy: directorId
            });

            await manager.save(history);

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
        directorId: string
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

            await manager.save(task);

            // History
            const history = manager.create(TaskStatusHistory, {
                taskId: task.id,
                oldStatus,
                newStatus: TaskStatus.REJECTED,
                changedBy: directorId
            });

            await manager.save(history);

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

    // Employee Tasks
    async getEmployeeTasks(employeeId: string) {
        return this.taskRepo.find({
            where: {
                assignedTo: employeeId
            },
            relations: ['template'],
            order: {
                dueDate: 'DESC'
            }
        });
    }

    // Director dashboard
    async getDirectorDashboard(directorId: string) {
        return this.taskRepo.find({
            relations: ['template'],
            where: {
                template: {
                    createdBy: directorId,
                }
            },
            order: {
                createdAt: 'DESC'
            }
        })
    }
}