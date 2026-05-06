import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Task, TaskStatus } from "./task.entity";
import { Repository } from "typeorm";
import { User, UserRole } from "../users/entities/user.entity";
import { CreateTaskDto } from "./dto/create-task.dto";

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>
    ) { }

    async createTask(
        directorId: string,
        dto: CreateTaskDto
    ): Promise<Task> {
        const director = await this.userRepo.findOne({
            where: {
                id: directorId,
                role: UserRole.DIRECTOR,
                isActive: true
            }
        });

        if (!director) {
            throw new ForbiddenException('Only director can assign task');
        }

        const employee = await this.userRepo.findOne({
            where: {
                id: dto.assignedToId,
                role: UserRole.EMPLOYEE,
                parentId: director.id,
                isActive: true
            }
        });

        if (!employee) {
            throw new BadRequestException('Employee not found under this director');
        }

        const task = this.taskRepo.create({
            title: dto.title,
            description: dto.description,
            assignedById: director.id,
            assignedToId: employee.id,
            status: TaskStatus.PENDING
        });

        return this.taskRepo.save(task);
    }

    getTasksForDirector(directorId: string): Promise<Task[]> {
        return this.taskRepo.find({
            where: {
                assignedById: directorId,
            },
            relations: {
                assignedTo: true
            },
            order: {
                createdAt: 'DESC'
            }
        });
    }

    getTasksForEmployee(employeeId: string): Promise<Task[]> {
        return this.taskRepo.find({
            where: {
                assignedToId: employeeId,
            },
            relations: {
                assignedBy: true,
            },
            order: {
                createdAt: 'DESC'
            }
        });
    }

    async completeTask(employeeId: string, taskId: string): Promise<Task> {
        const task = await this.taskRepo.findOne({
            where: {
                id: taskId,
                assignedToId: employeeId
            }
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        if (task.status === TaskStatus.CANCELLED) {
            throw new BadRequestException('Cancelled task cannot be completed');
        }

        task.status = TaskStatus.COMPLETED;

        return this.taskRepo.save(task);
    }

}