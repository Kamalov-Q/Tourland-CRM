import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { VerifyPincodeDto } from "./dto/verify-pincode.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "src/common/types/auth-request.type";


@ApiTags('Auth')
@Controller('auth')

export class AuthController {
    constructor(private readonly authSvc: AuthService) { }

    @Post('login')
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 201, description: 'User successfully logged in.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    login(@Body() dto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
        return this.authSvc.login(dto);
    }

    @Post('refresh')
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 201, description: 'Token successfully refreshed.' })
    @ApiResponse({ status: 401, description: 'Invalid refresh token.' })
    refresh(@Body() dto: RefreshDto) {
        return this.authSvc.refresh(dto);
    }

    @Post('verify-pincode')
    @ApiOperation({ summary: 'Verify pincode for password reset' })
    @ApiResponse({ status: 201, description: 'Pincode verified.' })
    @ApiResponse({ status: 400, description: 'Invalid pincode or phone number.' })
    verifyPincode(@Body() dto: VerifyPincodeDto) {
        return this.authSvc.verifyPincode(dto.phoneNumber, dto.pincode);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Reset password using pincode' })
    @ApiResponse({ status: 201, description: 'Password successfully reset.' })
    @ApiResponse({ status: 400, description: 'Invalid pincode or phone number.' })
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authSvc.forgotPassword(dto.phoneNumber, dto.pincode, dto.newPassword);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout and clear session' })
    @ApiResponse({ status: 201, description: 'Successfully logged out.' })
    logout(@CurrentUser() user: AuthenticatedUser) {
        return this.authSvc.logout(user.id);
    }

}