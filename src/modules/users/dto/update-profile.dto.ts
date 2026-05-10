import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateProfileDto {
    @ApiProperty({ description: 'User first name', required: false, example: 'Jane' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({ description: 'User last name', required: false, example: 'Smith' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiProperty({ description: 'User phone number', required: false, example: '+998909876543' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;
}
