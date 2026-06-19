/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { User } from '@/types/user';
import type { UserRole } from '@transit-logistic/shared';

import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: User }>();

    if (!user || !requiredRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'You do not have permission to access this resource.',
        message_ar: 'ليس لديك صلاحية للوصول إلى هذا المورد.',
      });
    }

    return true;
  }
}
