import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from './auth.service';

/**
 * @CurrentUser() injects the authenticated user (set by JwtAuthGuard from
 * the JWT payload) into a handler parameter.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as SafeUser;
  },
);
