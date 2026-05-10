import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthenticatedUser, JwtPayload } from "src/common/types/auth-request.type";
import { UsersService } from "src/modules/users/users.service";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService,
        private readonly usersSvc: UsersService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
        });
    }

    async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
        const user = await this.usersSvc.findActiveById(payload.sub);

        if (!user) {
            throw new UnauthorizedException('User not found or inactive');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('User is inactive');
        }

        return {
            id: user.id,
            phoneNumber: user.phoneNumber,
            role: user.role
        }
    }
}
