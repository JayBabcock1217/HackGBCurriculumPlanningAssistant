import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthUser } from './auth.entity';
import { Teacher } from '../teacher/teacher.entity';

export interface AuthUserDto {
  email: string;
  password: string;
  role?: 'teacher' | 'admin';
  firstName?: string;
  lastName?: string;
  /** Link to an existing teacher profile; created automatically when omitted. */
  teacherId?: string;
}

export interface SafeUser {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
  firstName?: string;
  lastName?: string;
  teacherId?: string | null;
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthUser)
    private authRepo: Repository<AuthUser>,
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
  ) {}

  /**
   * Create an auth account. A new teacher profile is created automatically
   * when none is supplied, so registration and first login work the same way.
   */
  async register(dto: AuthUserDto): Promise<SafeUser> {
    const existing = await this.authRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    let teacherId = dto.teacherId || null;
    if (!teacherId) {
      const teacher = this.teacherRepo.create({
        email: dto.email,
        firstName: dto.firstName || dto.email.split('@')[0],
        lastName: dto.lastName || 'Teacher',
      });
      const saved = await this.teacherRepo.save(teacher);
      teacherId = saved.id;
    }

    const user = this.authRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: dto.role === 'admin' ? 'admin' : 'teacher',
      teacherId,
      refreshTokens: [],
    });
    const saved = await this.authRepo.save(user);
    return this.toSafeUser(saved, await this.teacherOf(saved));
  }

  /** Verify credentials and issue a fresh refresh token (sliding session). */
  async login(email: string, password: string): Promise<SafeUser> {
    const user = await this.authRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    this.rotateRefreshToken(user);
    await this.authRepo.save(user);
    return this.toSafeUser(user, await this.teacherOf(user));
  }

  async logout(userId: string): Promise<void> {
    const user = await this.authRepo.findOne({ where: { id: userId } });
    if (!user) return;
    user.refreshTokens = [];
    await this.authRepo.save(user);
  }

  /**
   * Resolve an authenticated user from the JWT `sub`. The refresh token is
   * rotated on every request, which keeps sessions alive while actively used
   * and invalidates stolen-but-never-used tokens after 7 days.
   */
  async validateUser(userId: string): Promise<SafeUser> {
    const user = await this.authRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Unknown user');
    this.rotateRefreshToken(user);
    await this.authRepo.save(user);
    return this.toSafeUser(user, await this.teacherOf(user));
  }

  /** Admin: list all accounts. */
  async listUsers(): Promise<SafeUser[]> {
    const users = await this.authRepo.find();
    const out: SafeUser[] = [];
    for (const u of users) {
      out.push(this.toSafeUser(u, await this.teacherOf(u)));
    }
    return out;
  }

  /** Admin: promote or demote an account's role. */
  async setRole(userId: string, role: 'teacher' | 'admin'): Promise<SafeUser> {
    const user = await this.authRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    user.role = role;
    await this.authRepo.save(user);
    return this.toSafeUser(user, await this.teacherOf(user));
  }

  async remove(userId: string): Promise<void> {
    const user = await this.authRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    await this.authRepo.remove(user);
  }

  private async teacherOf(user: AuthUser): Promise<Teacher | null> {
    if (!user.teacherId) return null;
    return this.teacherRepo.findOne({ where: { id: user.teacherId } });
  }

  private rotateRefreshToken(user: AuthUser): void {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
    user.refreshTokens = [{ token, expiresAt }];
  }

  private toSafeUser(user: AuthUser, teacher: Teacher | null): SafeUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: teacher?.firstName,
      lastName: teacher?.lastName,
      teacherId: user.teacherId,
    };
  }
}
