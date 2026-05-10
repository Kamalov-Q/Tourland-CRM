import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TaskTemplate } from "../entities/task-template.entity";
import { LessThanOrEqual, MoreThanOrEqual, Not, Repository } from "typeorm";
import { TaskInstance } from "../entities/task-instance.entity";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Cron } from "@nestjs/schedule";
import { TaskStatus } from "../enums/task-status.enum";


@Injectable()
export class TasksCron {
    constructor(
        @InjectRepository(TaskTemplate)
        private readonly templateRepo: Repository<TaskTemplate>,
        @InjectRepository(TaskInstance)
        private readonly taskRepo: Repository<TaskInstance>,
        @InjectQueue('task-queue')
        private readonly taskQueue: Queue
    ) { }

    // Every minute 
    @Cron('* * * * *')
    async recurringTasksCron() {
        const now = new Date();

        const currentTime = now.toTimeString().slice(0, 5);
        // Only active templates
        const templates = await this.templateRepo.find({
            where: {
                isActive: true,
                startDate: LessThanOrEqual(now),
                endDate: MoreThanOrEqual(now)
            }
        });

        for (const template of templates) {
            if (template.notifyAt !== currentTime) {
                continue;
            }

            await this.taskQueue.add(
                'generate-task',
                {
                    templateId: template.id
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
    @Cron('59 23 * * *')
    async incompleteTasksCron() {

        const today = new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );

        const tasks = await this.taskRepo.find({
            where: {
                dueDate: today,
                status: Not(TaskStatus.DONE)
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