import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * RoleGuard (Chunk 11)
 *
 * Runs after JwtAuthGuard. Enforces the `@Roles(...)` metadata: a request
 * passes if the authenticated user's role is in the allow list. This is what
 * blocks role escalation — e.g. a teacher calling an @Roles('admin') route
 * gets a 403, not a 200.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        `Requires role: ${required.join(' or ')}`,
      );
    }
    return true;
  }
}
