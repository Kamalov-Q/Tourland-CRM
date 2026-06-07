import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class TourServiceDto {
    @ApiProperty({ example: 'Flight' })
    @IsString()
    nameEn: string;

    @ApiProperty({ example: 'Parvoz' })
    @IsString()
    nameUz: string;

    @ApiProperty({ example: 'Полет' })
    @IsString()
    nameRu: string;
}

export class CreateTourDto {
    @ApiProperty({ example: 'Premium Dubai Tour' })
    @IsString()
    nameEn: string;

    @ApiProperty({ example: 'Премиум тур в Дубай' })
    @IsString()
    nameRu: string;

    @ApiProperty({ example: 'Premium Dubay turi' })
    @IsString()
    nameUz: string;

    @ApiProperty({ required: false, example: 1 })
    @IsNumber()
    @IsOptional()
    orders?: number;

    @ApiProperty({ required: false, example: 'https://example.com/image.jpg' })
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({ required: false, example: 'https://example.com' })
    @IsString()
    @IsOptional()
    link?: string;

    @ApiProperty({ type: [TourServiceDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TourServiceDto)
    @IsOptional()
    services?: TourServiceDto[];
}
