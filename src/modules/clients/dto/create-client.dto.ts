import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateClientDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: '+998901234567' })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @ApiProperty({ required: false, example: 'Interested in tour packages' })
    @IsOptional()
    @IsString()
    description: string;

    @ApiProperty({ example: 'uuid-of-department' })
    @IsUUID()
    departmentId: string;
}