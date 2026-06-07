import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class VerifyPincodeDto {
    @ApiProperty({ example: '+998901234567' })
    @IsNotEmpty()
    @IsString()
    phoneNumber: string;

    @ApiProperty({ example: '1234' })
    @IsNotEmpty()
    @IsString()
    pincode: string;
}
