import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";


@ApiTags('auth')
@Controller('auth')

export class AuthController {
    constructor(private readonly authSvc: AuthService) { }

    @Post('login')
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 201, description: 'User successfully logged in.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {

        return this.authSvc.login(dto);
    }

}