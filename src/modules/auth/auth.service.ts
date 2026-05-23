import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from 'bcrypt';
import { JwtPayload } from "src/common/types/auth-request.type";

import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService {
    constructor(
        private readonly usersSvc: UsersService,
        private readonly jwtSvc: JwtService,
        private readonly configSvc: ConfigService
    ) { }

    async login(dto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
        const user = await this.usersSvc.findByPhoneWithPassword(dto.phoneNumber);

        if (!user) {
            throw new UnauthorizedException('Invalid phone number or password');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid password');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('User is inactive');
        }

        const payload: JwtPayload = {
            sub: user.id,
            phoneNumber: user.phoneNumber,
            role: user.role
        }

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtSvc.signAsync(payload),
            this.jwtSvc.signAsync(payload, { expiresIn: '7d' }) // Refresh token lasts longer
        ]);

        await this.usersSvc.updateRefreshToken(user.id, refreshToken);

        return {
            accessToken,
            refreshToken
        }
    }

    async refresh(dto: { refreshToken: string }): Promise<{ accessToken: string, refreshToken: string }> {
        try {
            const payload = await this.jwtSvc.verifyAsync<JwtPayload>(dto.refreshToken);
            const user = await this.usersSvc.findById(payload.sub);

            if (!user || !user.isActive) {
                throw new UnauthorizedException('User not found or inactive');
            }

            // Verify stored refresh token hash
            const dbUser = await this.usersSvc.findByPhoneWithPassword(user.phoneNumber);
            // We need to fetch it with select: true if we want to compare, 
            // but queryBuilder.addSelect('user.refreshToken') is better.
            // Let's adjust UsersService or use queryBuilder here.
            
            const userWithToken = await this.usersSvc.findByIdWithRefreshToken(payload.sub);

            if (!userWithToken || !userWithToken.refreshToken) {
                throw new UnauthorizedException('Session expired');
            }

            const isMatch = await bcrypt.compare(dto.refreshToken, userWithToken.refreshToken);
            if (!isMatch) {
                throw new UnauthorizedException('Invalid session');
            }

            const newPayload: JwtPayload = {
                sub: user.id,
                phoneNumber: user.phoneNumber,
                role: user.role
            };

            const [accessToken, newRefreshToken] = await Promise.all([
                this.jwtSvc.signAsync(newPayload),
                this.jwtSvc.signAsync(newPayload, { expiresIn: '7d' })
            ]);

            await this.usersSvc.updateRefreshToken(user.id, newRefreshToken);

            return {
                accessToken,
                refreshToken: newRefreshToken
            };
        } catch (e) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async verifyPincode(phoneNumber: string, pincode: string): Promise<{ valid: boolean }> {
        const user = await this.usersSvc.findByPhoneWithPassword(phoneNumber);
        if (!user || !user.isActive) {
            return { valid: false }; // Don't leak user existence directly via explicit error if possible, but valid: false is fine
        }

        const envPincode = this.configSvc.get<string>('RESET_PINCODE');
        if (!envPincode || pincode !== envPincode) {
            return { valid: false };
        }

        return { valid: true };
    }

    async forgotPassword(phoneNumber: string, pincode: string, newPassword: string): Promise<{ message: string }> {
        const check = await this.verifyPincode(phoneNumber, pincode);
        if (!check.valid) {
            throw new UnauthorizedException('Invalid phone number or pincode');
        }
        
        await this.usersSvc.resetPasswordByPhone(phoneNumber, newPassword);
        return { message: 'Password reset successfully' };
    }

    async logout(userId: string): Promise<void> {
        await this.usersSvc.updateRefreshToken(userId, null);
    }

}