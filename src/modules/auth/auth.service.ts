import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from 'bcrypt';
import { JwtPayload } from "src/common/types/auth-request.type";

@Injectable()
export class AuthService {
    constructor(
        private readonly usersSvc: UsersService,
        private readonly jwtSvc: JwtService
    ) { }

    async login(dto: LoginDto): Promise<{ accessToken: string }> {
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

        return {
            accessToken: await this.jwtSvc.signAsync(payload)
        }
    }

}