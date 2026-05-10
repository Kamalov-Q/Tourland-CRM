import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password', example: 'oldPassword123' })
    @IsString()
    oldPassword: string;

    @ApiProperty({ description: 'New password', example: 'newPassword123', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword: string;
}