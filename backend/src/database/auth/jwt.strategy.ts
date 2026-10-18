import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, SafeUser } from './auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'teacher' | 'admin';
}

/**
 * JwtStrategy (Chunk 11)
 *
 * Verifies the Bearer token (HS256, signed with AUTH_JWT_SECRET) and resolves
 * the user from the database so role changes take effect immediately — the
 * token itself never carries mutable claims.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.AUTH_JWT_SECRET || 'hackgb-dev-jwt-secret-change-in-prod',
    });
  }

  async validate(payload: JwtPayload): Promise<SafeUser> {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
