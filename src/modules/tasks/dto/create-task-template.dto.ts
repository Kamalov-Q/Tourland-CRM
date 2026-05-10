import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateTaskTemplateDto {
    @ApiProperty({ description: 'Task title', example: 'Daily Report' })
    @IsString()
    title: string;

    @ApiProperty({ description: 'Task description', required: false, example: 'Generate the daily sales report' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'User assigned to the task template', example: 'John Doe' })
    @IsString()
    assignedTo: string;

    @ApiProperty({ description: 'Notification time or message', example: '9:00 AM' })
    @IsString()
    notifyAt: string;

    @ApiProperty({ description: 'Start date of the template period', example: '2024-01-01' })
    @IsDateString()
    startDate: Date;

    @ApiProperty({ description: 'End date of the template period', example: '2024-12-31' })
    @IsDateString()
    endDate: Date;
}