import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService, AuthUserDto, SafeUser } from './auth.service';
import { Roles } from './roles.decorator';
import { CurrentUser } from './current-user.decorator';
import { Public } from './jwt-auth.guard';

export interface LoginDto {
  email: string;
  password: string;
}

export interface SetRoleDto {
  role: 'teacher' | 'admin';
}

/**
 * AuthController (Chunk 11)
 *
 * Public:
 *   POST /api/auth/register
 *   POST /api/auth/login
 * Authenticated:
 *   GET  /api/auth/me
 *   POST /api/auth/logout
 * Admin:
 *   GET  /api/auth/users
 *   PATCH /api/auth/users/:id/role
 *
 * register/login return `{ ...user, accessToken }` so the frontend can store
 * the token and attach it as a Bearer header on every subsequent call.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: AuthUserDto) {
    const user = await this.authService.register(dto);
    return { ...user, accessToken: this.tokenFor(user) };
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.login(dto.email, dto.password);
    return { ...user, accessToken: this.tokenFor(user) };
  }

  @Get('me')
  async me(@CurrentUser() user: SafeUser): Promise<SafeUser> {
    return user;
  }

  @Post('logout')
  async logout(@CurrentUser() user: SafeUser): Promise<void> {
    await this.authService.logout(user.id);
  }

  private tokenFor(user: SafeUser): string {
    return this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  }

  @Roles('admin')
  @Get('users')
  async users(): Promise<SafeUser[]> {
    return this.authService.listUsers();
  }

  @Roles('admin')
  @Patch('users/:id/role')
  async setRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ): Promise<SafeUser> {
    return this.authService.setRole(id, dto.role);
  }
}
