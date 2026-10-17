import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherService } from './teacher.service';
import { Teacher } from './teacher.entity';
import { NotFoundException } from '@nestjs/common';

describe('TeacherService', () => {
  let service: TeacherService;
  let teacherRepo: Repository<Teacher>;

  const mockTeacher = {
    id: 'teacher-1',
    email: 'teacher@school.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    schoolName: 'Lincoln Elementary',
    gradeLevel: '3rd',
    subject: 'Math',
    language: 'en' as const,
    role: 'teacher' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockTeacherRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => ({ ...entity, id: 'teacher-1' })),
      find: jest.fn(() => [mockTeacher]),
      findOne: jest.fn(() => mockTeacher),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        {
          provide: getRepositoryToken(Teacher),
          useValue: mockTeacherRepo,
        },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
    teacherRepo = module.get<Repository<Teacher>>(
      getRepositoryToken(Teacher),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a teacher', async () => {
      const result = await service.create({
        email: 'new@school.com',
        firstName: 'New',
        lastName: 'Teacher',
      });
      expect(teacherRepo.save).toHaveBeenCalled();
      expect(result.email).toBe('new@school.com');
    });
  });

  describe('findByEmail', () => {
    it('should find teacher by email', async () => {
      const result = await service.findByEmail('teacher@school.com');
      expect(result?.email).toBe('teacher@school.com');
    });

    it('should return null if not found', async () => {
      (teacherRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      const result = await service.findByEmail('nonexistent@school.com');
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return a teacher by id', async () => {
      const result = await service.findOne('teacher-1');
      expect(result.id).toBe('teacher-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (teacherRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a teacher', async () => {
      const result = await service.update('teacher-1', {
        schoolName: 'Roosevelt Elementary',
      });
      expect(result.schoolName).toBe('Roosevelt Elementary');
    });
  });

  describe('remove', () => {
    it('should delete a teacher', async () => {
      await service.remove('teacher-1');
      expect(teacherRepo.remove).toHaveBeenCalled();
    });
  });
});
