import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class ClientMessageDto {
    @ApiProperty({ example: 'uuid-of-client', description: 'Client UUID' })
    @IsUUID()
    @IsNotEmpty()
    clientId: string;

    @ApiProperty({ example: '123456789', description: 'Telegram User ID' })
    @IsString()
    @IsNotEmpty()
    telegramId: string;

    @ApiProperty({ example: 'Hello, here is your tour info.', description: 'Message content (supports HTML)' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ required: false, example: 'https://example.com', description: 'Optional link' })
    @IsOptional()
    @IsString()
    link?: string;
}
