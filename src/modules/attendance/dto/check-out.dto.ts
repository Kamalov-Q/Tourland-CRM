import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CheckOutDto {
    @ApiProperty({ description: 'Base64 image data' })
    @IsNotEmpty()
    @IsString()
    photo: string;
}
