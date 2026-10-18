import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthUser } from './auth.entity';
import { Teacher } from '../teacher/teacher.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * AuthModule (Chunk 11)
 *
 * Registers Passport + JWT and exports the guards as providers so they can be
 * applied globally in AppModule (APP_GUARD). Register/login are @Public;
 * everything else requires a valid Bearer token and, where annotated, a role.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AuthUser, Teacher]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:
        process.env.AUTH_JWT_SECRET || 'hackgb-dev-jwt-secret-change-in-prod',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PassportModule, JwtModule],
})
export class AuthModule {}
