import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class BroadcastMessageDto {
    @ApiProperty({ example: ['123456789'], description: 'Array of Telegram user IDs' })
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    telegramIds: string[];

    @ApiProperty({ example: 'Important update!', description: 'Message content (supports HTML)' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ required: false, example: 'https://example.com', description: 'Optional link to include in the message' })
    @IsOptional()
    @IsString()
    link?: string;
}
