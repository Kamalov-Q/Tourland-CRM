import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { TaskTemplate } from "../entities/task-template.entity";
import { LessThanOrEqual, MoreThanOrEqual, In, Repository } from "typeorm";
import { TaskInstance } from "../entities/task-instance.entity";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Cron } from "@nestjs/schedule";
import { TaskStatus } from "../enums/task-status.enum";


@Injectable()
export class TasksCron {
    private readonly timeZone: string;

    constructor(
        @InjectRepository(TaskTemplate)
        private readonly templateRepo: Repository<TaskTemplate>,
        @InjectRepository(TaskInstance)
        private readonly taskRepo: Repository<TaskInstance>,
        @InjectQueue('task-queue')
        private readonly taskQueue: Queue,
        private readonly configSvc: ConfigService
    ) {
        this.timeZone = this.configSvc.get<string>('TZ', 'Asia/Tashkent');
    }

    // Every minute 
    @Cron('* * * * *', { timeZone: 'Asia/Tashkent' })
    async recurringTasksCron() {
        const now = new Date();

        const currentTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });

        const tzDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
        const todayStart = new Date(`${tzDateStr}T00:00:00.000Z`);
        const todayEnd = new Date(`${tzDateStr}T23:59:59.999Z`);

        // Only active templates
        const templates = await this.templateRepo.find({
            where: {
                isActive: true,
                startDate: LessThanOrEqual(todayEnd),
                endDate: MoreThanOrEqual(todayStart)
            }
        });

        for (const template of templates) {
            if (template.notifyAt !== currentTime) {
                continue;
            }

            await this.taskQueue.add(
                'generate-task',
                {
                    templateId: template.id,
                    isCron: true
                },
                {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    }
                }
            )
        }

    }

    // Every day 23:59
    @Cron('59 23 * * *', { timeZone: 'Asia/Tashkent' })
    async incompleteTasksCron() {

        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
        const today = new Date(`${tzDateStr}T00:00:00.000Z`);

        const tasks = await this.taskRepo.find({
            where: {
                dueDate: today,
                status: In([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.PENDING])
            }
        });

        for (const task of tasks) {
            await this.taskQueue.add(
                'mark-incomplete',
                {
                    taskId: task.id,
                },
                {
                    attempts: 2,
                }
            )
        }

    }

}