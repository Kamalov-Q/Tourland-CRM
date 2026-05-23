import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsPhoneNumber, IsString } from "class-validator";

export class VerifyPincodeDto {
    @ApiProperty({ example: '+998901234567' })
    @IsNotEmpty()
    @IsPhoneNumber('UZ')
    phoneNumber: string;

    @ApiProperty({ example: '1234' })
    @IsNotEmpty()
    @IsString()
    pincode: string;
}
