import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { ClientStage, SaleStatus } from "../enums/client.enums";

export class UpdateClientDto {
    @ApiProperty({ required: false, example: 'John Doe' })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    fullName?: string;

    @ApiProperty({ required: false, example: '+998901234567' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false, example: 'uuid-of-department' })
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @ApiProperty({ required: false, enum: ClientStage })
    @IsOptional()
    @IsEnum(ClientStage)
    stage?: ClientStage;
}

export class AddNoteDto {
    @ApiProperty({ example: 'Client called back, interested in premium plan.' })
    @IsString()
    @IsNotEmpty()
    text: string;
}

export class AddPaymentDto {
    @ApiProperty({ example: 150000 })
    @IsNumber()
    @Min(0)
    amount: number;
}

export class SetSaleDto {
    @ApiProperty({ enum: SaleStatus })
    @IsEnum(SaleStatus)
    status: SaleStatus;

    @ApiProperty({ required: false, example: 500000 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    totalAmount?: number;

    @ApiProperty({ required: false, example: '2026-06-01T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    nextPaymentAt?: string;
}
