import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';

export class UpdateEmployeeDto {
    @ApiProperty({ description: 'Employee first name', required: false, example: 'John' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({ description: 'Employee last name', required: false, example: 'Doe' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiProperty({ description: 'Employee phone number', required: false, example: '+998901234567' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiProperty({ description: 'Employee password', required: false, example: 'password123', minLength: 6 })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @ApiProperty({ description: 'Is employee active', required: false, example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}