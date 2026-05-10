import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { TaskTemplate } from "../entities/task-template.entity";
import { Repository } from "typeorm";
import { TaskInstance } from "../entities/task-instance.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationGateway } from "../gateways/notification.gateway";
import { Job } from "bullmq";
import { TaskStatus } from "../enums/task-status.enum";
import { NotificationType } from "../enums/notification-type.enum";
import { User } from "src/modules/users/entities/user.entity";

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
        private gateway: NotificationGateway
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

        const now = new Date();

        // Validating range
        if (now < template.startDate || now > template.endDate) {
            return;
        }

        const today = new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );

        // Preventing duplications
        const existing = await this.taskRepo.findOne({
            where: {
                templateId: template.id,
                dueDate: today
            }
        });

        if (existing) {
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

    async markIncomplete(data: any) {
        const task = await this.taskRepo.findOne({
            where: {
                id: data.taskId
            }
        });

        if (!task) return;

        if (task.status === TaskStatus.DONE) {
            return;
        }

        task.status = TaskStatus.INCOMPLETE;

        await this.taskRepo.save(task);

        this.gateway.emitTaskIncomplete(task.assignedTo, {
            taskId: task.id
        })
    }
}