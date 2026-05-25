import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_ACCESS_KEY, AppModule } from '../decorators/module-access.decorator';
import { UserRole } from 'src/modules/users/entities/user.entity';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const module = this.reflector.getAllAndOverride<AppModule>(MODULE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!module) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    if (user.role === UserRole.DIRECTOR) {
      return true;
    }

    if (module === 'departments' && user.canAccessDepartments === false) {
      throw new ForbiddenException("Sizga ushbu bo'limga kirishga ruxsat berilmagan.");
    }

    if (module === 'forms' && user.canAccessForms === false) {
      throw new ForbiddenException("Sizga ushbu formaga kirishga ruxsat berilmagan.");
    }

    return true;
  }
}
