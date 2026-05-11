import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { TaskTemplate } from "../entities/task-template.entity";
import { Repository } from "typeorm";
import { TaskInstance } from "../entities/task-instance.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationGateway } from "../gateways/notification.gateway";
import { User } from "src/modules/users/entities/user.entity";
import { DataSource } from "typeorm";
import { TaskStatusHistory } from "../entities/task-status-history.entity";
import { Job } from "bullmq";
import { TaskStatus } from "../enums/task-status.enum";
import { NotificationType } from "../enums/notification-type.enum";
import { ActivityLog } from "../../archive/entities/activity-log.entity";

@Processor('task-queue')
export class TasksProcessor extends WorkerHost {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        @InjectRepository(TaskTemplate)
        private readonly templateRepo: Repository<TaskTemplate>,
        @InjectRepository(TaskInstance)
        private readonly taskRepo: Repository<TaskInstance>,
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        private gateway: NotificationGateway,
        private readonly dataSource: DataSource
    ) {
        super();
    }

    async process(job: Job) {
        switch (job.name) {
            case 'generate-task':
                await this.generateTask(job.data);
                break;
            case 'mark-incomplete':
                await this.markIncomplete(job.data);
                break;
        }
    }

    async generateTask(data: any) {
        const template = await this.templateRepo.findOne({
            where: {
                id: data.templateId
            }
        });

        if (!template) return;

        const employee = await this.usersRepo.findOne({
            where: {id: template.assignedTo}
        });

        if (!employee?.isActive) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDay = new Date(template.startDate);
        startDay.setHours(0, 0, 0, 0);

        const endDay = new Date(template.endDate);
        endDay.setHours(23, 59, 59, 999);

        if (today < startDay || today > endDay) {
            return;
        }


        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const shouldNotifyNow = data.isCron || template.notifyAt <= currentTime;

        // Preventing duplications
        const existing = await this.taskRepo.findOne({
            where: {
                templateId: template.id,
                dueDate: today
            }
        });

        if (existing) {
            if (data.isCron) {
                await this.notificationRepo.save({
                    userId: template.assignedTo,
                    type: NotificationType.TASK_CREATED,
                    message: `New task: ${template.title}`
                });

                this.gateway.emitTaskCreated(template.assignedTo, {
                    taskId: existing.id,
                    title: template.title
                });
            }
            return;
        }

        const expiresAt = new Date();

        expiresAt.setHours(
            23,
            59,
            59,
            999
        );

        const task = this.taskRepo.create({
            templateId: template.id,
            assignedTo: template.assignedTo,
            dueDate: today,
            expiresAt,
            status: TaskStatus.TODO,
        });

        const savedTask = await this.taskRepo.save(task);

        if (shouldNotifyNow) {
            // Saving the notification
            await this.notificationRepo.save({
                userId: template.assignedTo,
                type: NotificationType.TASK_CREATED,
                message: `New task: ${template.title}`
            });

            // Websocket
            this.gateway.emitTaskCreated(template.assignedTo, {
                taskId: savedTask.id,
                title: template.title
            });
        }
    }

    async markIncomplete(data: any) {
        return this.dataSource.transaction(async manager => {
            const task = await manager.findOne(TaskInstance, {
                where: {
                    id: data.taskId
                },
                relations: ['template']
            });

            if (!task) return;

            if (
                task.status === TaskStatus.DONE ||
                task.status === TaskStatus.INCOMPLETE ||
                task.status === TaskStatus.REJECTED
            ) {
                return;
            }

            const oldStatus = task.status;
            task.status = TaskStatus.INCOMPLETE;

            await manager.save(task);

            // History
            const history = manager.create(TaskStatusHistory, {
                taskId: task.id,
                oldStatus,
                newStatus: TaskStatus.INCOMPLETE,
                changedBy: task.template?.createdBy || task.assignedTo
            });

            await manager.save(history);

            await manager.save(ActivityLog, {
                userId: task.assignedTo,
                actionType: 'TASK_INCOMPLETE',
                details: {
                    taskId: task.id,
                    title: task.template?.title,
                    status: TaskStatus.INCOMPLETE,
                    systemAction: true
                }
            });

            // Notification
            await manager.save(Notification, {
                userId: task.assignedTo,
                type: NotificationType.TASK_STATUS_CHANGED,
                message: `Task marked as incomplete automatically`
            });

            this.gateway.emitTaskIncomplete(task.assignedTo, {
                taskId: task.id,
                oldStatus,
                newStatus: TaskStatus.INCOMPLETE,
                changedAt: history.changedAt
            });

            if (task.template?.createdBy) {
                this.gateway.emitTaskIncomplete(task.template.createdBy, {
                    taskId: task.id,
                    oldStatus,
                    newStatus: TaskStatus.INCOMPLETE,
                    changedAt: history.changedAt
                });
            }
        });
    }
}