import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SubmitFormDto {
  @ApiProperty({
    description: 'Dynamic form data where keys are field labels and values are user inputs',
    example: { 'Ism familya': 'John Doe', 'Interests': ['Sports', 'Music'] },
    type: 'object',
    additionalProperties: true
  })
  @IsObject()
  data: Record<string, any>;
}
