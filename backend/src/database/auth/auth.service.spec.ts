import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.entity';
import { Teacher } from '../teacher/teacher.entity';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let authRepo: Repository<AuthUser>;
  let teacherRepo: Repository<Teacher>;

  const mockTeacher = {
    id: 'teacher-1',
    email: 't@school.edu',
    firstName: 'Tessa',
    lastName: 'Teacher',
  };

  beforeEach(async () => {
    const mockAuthRepo = {
      findOne: jest.fn(() => null),
      find: jest.fn(() => []),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entity) => ({ ...entity, id: 'user-1' })),
      remove: jest.fn(),
    };
    const mockTeacherRepo = {
      findOne: jest.fn(() => null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entity) => ({ ...entity, id: 'teacher-1' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(AuthUser), useValue: mockAuthRepo },
        { provide: getRepositoryToken(Teacher), useValue: mockTeacherRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepo = module.get<Repository<AuthUser>>(getRepositoryToken(AuthUser));
    teacherRepo = module.get<Repository<Teacher>>(getRepositoryToken(Teacher));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create an account and a teacher profile', async () => {
      const result = await service.register({
        email: 'new@school.edu',
        password: 'hunter2',
        firstName: 'New',
        lastName: 'Teacher',
      });
      expect(authRepo.save).toHaveBeenCalled();
      expect(teacherRepo.save).toHaveBeenCalled();
      expect(result.email).toBe('new@school.edu');
      expect(result.role).toBe('teacher');
      expect(result.teacherId).toBe('teacher-1');
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should reject duplicate emails', async () => {
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce({
        id: 'user-1',
        email: 'dup@school.edu',
      });
      await expect(
        service.register({ email: 'dup@school.edu', password: 'x' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should respect an explicit admin role', async () => {
      const result = await service.register({
        email: 'admin@school.edu',
        password: 'hunter2',
        role: 'admin',
        teacherId: 'teacher-1',
      });
      expect(result.role).toBe('admin');
      expect(teacherRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should succeed with correct credentials and rotate the refresh token', async () => {
      const hash = await bcrypt.hash('correct', 4);
      const user = {
        id: 'user-1',
        email: 't@school.edu',
        passwordHash: hash,
        role: 'teacher',
        teacherId: 'teacher-1',
        refreshTokens: [{ token: 'old', expiresAt: '2020-01-01' }],
      };
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(user);
      (teacherRepo.findOne as jest.Mock).mockResolvedValueOnce(mockTeacher);

      const result = await service.login('T@school.edu', 'correct');

      expect(result).toMatchObject({
        id: 'user-1',
        role: 'teacher',
        firstName: 'Tessa',
        lastName: 'Teacher',
      });
      // Sliding refresh token: exactly one token, a fresh one
      expect(user.refreshTokens).toHaveLength(1);
      expect(user.refreshTokens[0].token).not.toBe('old');
      expect(authRepo.save).toHaveBeenCalledWith(user);
    });

    it('should reject an unknown email', async () => {
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.login('nobody@x.com', 'pw')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a wrong password', async () => {
      const hash = await bcrypt.hash('correct', 4);
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce({
        id: 'user-1',
        passwordHash: hash,
      });
      await expect(service.login('t@school.edu', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear all refresh tokens', async () => {
      const user = {
        id: 'user-1',
        refreshTokens: [{ token: 'a' }, { token: 'b' }],
      };
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(user);
      await service.logout('user-1');
      expect(user.refreshTokens).toEqual([]);
      expect(authRepo.save).toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should resolve the user from the db (role changes take effect)', async () => {
      const user = {
        id: 'user-1',
        email: 't@school.edu',
        role: 'admin',
        teacherId: 'teacher-1',
        refreshTokens: [],
      };
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(user);
      (teacherRepo.findOne as jest.Mock).mockResolvedValueOnce(mockTeacher);
      const result = await service.validateUser('user-1');
      expect(result.role).toBe('admin');
    });

    it('should reject an unknown user', async () => {
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.validateUser('ghost')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('setRole', () => {
    it('should update the role', async () => {
      const user = { id: 'user-1', role: 'teacher' };
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(user);
      const result = await service.setRole('user-1', 'admin');
      expect(user.role).toBe('admin');
      expect(result.role).toBe('admin');
    });

    it('should throw NotFoundException for a missing user', async () => {
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.setRole('ghost', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete the account', async () => {
      (authRepo.findOne as jest.Mock).mockResolvedValueOnce({ id: 'user-1' });
      await service.remove('user-1');
      expect(authRepo.remove).toHaveBeenCalled();
    });
  });
});
