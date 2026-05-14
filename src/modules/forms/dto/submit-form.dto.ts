import { ApiProperty } from '@nestjs/swagger';

export class SubmitFormDto {
  @ApiProperty({
    description: 'Dynamic form data where keys are field labels and values are user inputs',
    example: { 'Ism familya': 'John Doe', 'Tel raqam': '+998901234567' },
    type: 'object',
    additionalProperties: { type: 'string' }
  })
  data: Record<string, string>;
}
