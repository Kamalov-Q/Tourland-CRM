import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CheckOutDto {
    @ApiPropertyOptional({ description: 'Base64 image data (optional for auto-checkout)' })
    @IsOptional()
    @IsString()
    photo?: string;
}
