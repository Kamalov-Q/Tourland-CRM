import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormFieldType } from '../enums/form-field-type.enum';

export class FieldDto {
  @ApiProperty({ enum: FormFieldType, example: FormFieldType.TEXT })
  @IsEnum(FormFieldType)
  type: FormFieldType;

  @ApiProperty({ example: 'Full Name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  label: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false, type: [String], example: ['Option 1', 'Option 2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateFormDto {
  @ApiProperty({ example: 'Client Intake Form' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  title: string;

  @ApiProperty({ example: 'uuid-of-department' })
  @IsUUID()
  targetDepartmentId: string;

  @ApiProperty({ type: [FieldDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  fields: FieldDto[];
}
