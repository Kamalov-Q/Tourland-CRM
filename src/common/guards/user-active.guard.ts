import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class UserActiveGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user (e.g. public route), allow. 
    // This guard should usually come after JwtAuthGuard.
    if (!user) {
      return true;
    }

    // Directors are always allowed (or we assume they are active)
    if (user.role === 'DIRECTOR') {
      return true;
    }

    // For employees, check isActive status
    if (!user.isActive) {
      // Always allow GET requests (read-only access)
      if (request.method === 'GET') {
        return true;
      }

      // Block all mutations (POST, PATCH, DELETE, PUT) in controllers where this guard is applied
      throw new ForbiddenException(
        "Sizning hisobingiz vaqtincha faolsizlantirilgan. Ushbu amalni bajarish uchun ruxsat yo'q. Iltimos, direktor bilan bog'laning."
      );
    }

    return true;
  }
}
