import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

/**
 * Guard that enforces mandatory password change on protected endpoints.
 *
 * Rules:
 * - If endpoint is decorated with @AllowPasswordChange(), access is permitted.
 * - If user is unauthenticated or not a STUDENT, access is permitted (delegating
 *   role and authentication verification to JwtAuthGuard / RolesGuard).
 * - For authenticated STUDENT users, authoritative Student.mustChangePassword is
 *   queried directly from the database (never trusting JWT claims).
 * - If mustChangePassword is true, throws 403 ForbiddenException.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isExempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isExempt) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    // Guard applies only to authenticated STUDENT users
    if (!user || user.role !== UserRole.STUDENT) {
      return true;
    }

    // Authoritative check against database state
    const student = await this.prisma.student.findUnique({
      where: { userId: user.sub },
      select: { mustChangePassword: true },
    });

    if (student?.mustChangePassword) {
      throw new ForbiddenException(
        'Password change required before accessing this resource',
      );
    }

    return true;
  }
}
