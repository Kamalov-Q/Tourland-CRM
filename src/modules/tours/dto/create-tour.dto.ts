import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class TourServiceDto {
    @IsString()
    nameEn: string;

    @IsString()
    nameUz: string;

    @IsString()
    nameRu: string;
}

export class CreateTourDto {
    @IsString()
    nameEn: string;

    @IsString()
    nameRu: string;

    @IsString()
    nameUz: string;

    @IsNumber()
    @IsOptional()
    orders?: number;

    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsString()
    @IsOptional()
    link?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TourServiceDto)
    @IsOptional()
    services?: TourServiceDto[];
}
