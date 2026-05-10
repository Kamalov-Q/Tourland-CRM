import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateDirectorProfileDto {
    @ApiProperty({ description: 'Director first name', required: false, example: 'Jane' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({ description: 'Director last name', required: false, example: 'Smith' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiProperty({ description: 'Director phone number', required: false, example: '+998909876543' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;
}