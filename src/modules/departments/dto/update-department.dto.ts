import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsNotEmpty } from "class-validator";

export class UpdateDepartmentDto {
    @ApiProperty({ required: false, example: 'Marketing' })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string;
}
