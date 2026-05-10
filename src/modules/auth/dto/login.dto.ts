import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";


export class LoginDto {
    @ApiProperty({
        description: 'User phone number',
        example: '998931004027'
    })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;


    @ApiProperty({
        description: 'User password',
        example: 'director123',
        minLength: 6
    })
    @IsString()
    @MinLength(6)
    password: string;

}