import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";


export class CreateTaskDto {
    @ApiProperty({ description: 'Task title', example: 'Clean the office' })
    @IsString()
    @IsNotEmpty()
    title: string;


    @ApiProperty({ description: 'Task description', example: 'Mop the floors and dust the desks', required: false })
    @IsOptional()
    @IsString()
    description: string;


    @ApiProperty({ description: 'UUID of the employee assigned to the task', example: '550e8400-e29b-41d4-a716-446655440000' })
    @IsUUID()
    assignedToId: string;


}