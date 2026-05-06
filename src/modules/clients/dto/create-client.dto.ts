import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateClientDto {
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @IsOptional()
    @IsString()
    description: string;

    @IsUUID()
    departmentId: string;
}