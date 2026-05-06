import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, AuthenticatedUser } from "../types/auth-request.type";

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
        const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
        return request.user
    }
)