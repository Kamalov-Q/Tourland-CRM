import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { TaskStatus } from "../task.entity";


export class UpdateTaskStatusDto {
    @ApiProperty({ enum: TaskStatus, description: 'Task status' })
    @IsEnum(TaskStatus)
    status: TaskStatus;

}