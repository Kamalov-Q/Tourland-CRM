import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';


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

}