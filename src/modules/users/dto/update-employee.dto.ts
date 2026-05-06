import {
    IsBoolean,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';

export class UpdateEmployeeDto {
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}