import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';


export class CreateEmployeeDto {
    @ApiProperty({ description: 'Employee first name', example: 'John' })
    @IsString()
    @IsNotEmpty()
    firstName: string;


    @ApiProperty({ description: 'Employee last name', example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    lastName: string;


    @ApiProperty({ description: 'Employee phone number', example: '+998901234567' })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;


    @ApiProperty({ description: 'Employee password', example: 'password123', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ description: 'Can access departments', required: false, example: true })
    @IsOptional()
    @IsBoolean()
    canAccessDepartments?: boolean;

    @ApiProperty({ description: 'Can access forms', required: false, example: true })
    @IsOptional()
    @IsBoolean()
    canAccessForms?: boolean;

}