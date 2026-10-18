import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentService } from './student.service';
import { Student } from './student.entity';
import { ProgressEntry } from './progress-entry.entity';
import { NotFoundException } from '@nestjs/common';

describe('StudentService', () => {
  let service: StudentService;
  let studentRepo: Repository<Student>;
  let progressRepo: Repository<ProgressEntry>;
  let qb: { where: jest.Mock; andWhere: jest.Mock };

  const mockStudent = {
    id: 'student-1',
    firstName: 'John',
    lastName: 'Doe',
    gradeLevel: '3rd',
    readingLevel: 3.2,
    mathAbility: 2.8,
    skills: ['addition', 'subtraction'],
    iepDetails: null,
    ellStatus: null,
    learningDifferences: [],
    socialEmotionalNotes: null,
    teacherNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    qb = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getMany: jest.fn(() => [mockStudent]),
    } as any;
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);

    const mockStudentRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => ({ ...entity, id: 'student-1' })),
      find: jest.fn(() => [mockStudent]),
      findOne: jest.fn(() => mockStudent),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
    };

    const mockProgressRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => ({ ...entity, id: 'progress-1' })),
      find: jest.fn(() => []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        {
          provide: getRepositoryToken(Student),
          useValue: mockStudentRepo,
        },
        {
          provide: getRepositoryToken(ProgressEntry),
          useValue: mockProgressRepo,
        },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
    studentRepo = module.get<Repository<Student>>(
      getRepositoryToken(Student),
    );
    progressRepo = module.get<Repository<ProgressEntry>>(
      getRepositoryToken(ProgressEntry),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a student with all profile fields', async () => {
      const result = await service.create({
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: '3rd',
        readingLevel: 3.2,
        mathAbility: 2.8,
        skills: ['addition'],
        iepDetails: { planType: 'IEP', accommodations: ['extra time'] },
        ellStatus: { homeLanguage: 'Spanish', englishProficiency: 'intermediate' },
        learningDifferences: [{ type: 'dyslexia', diagnosed: true }],
        socialEmotionalNotes: 'Shy but improving',
        teacherId: 'teacher-1',
      });
      expect(studentRepo.create).toHaveBeenCalled();
      expect(studentRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all students', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by teacherId', async () => {
      await service.findAll('teacher-1');
      expect(studentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teacher: { id: 'teacher-1' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a student by id', async () => {
      const result = await service.findOne('student-1');
      expect(result.id).toBe('student-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (studentRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a student', async () => {
      const result = await service.update('student-1', {
        readingLevel: 3.5,
      });
      expect(result.readingLevel).toBe(3.5);
    });
  });

  describe('addProgressEntry', () => {
    it('should add a progress entry', async () => {
      const result = await service.addProgressEntry('student-1', {
        skillArea: 'reading',
        skillName: 'phonics',
        score: 85,
        maxScore: 100,
      });
      expect(progressRepo.save).toHaveBeenCalled();
      expect(result.skillName).toBe('phonics');
    });
  });

  describe('findByReadingLevel', () => {
    it('should scope by teacher and add a minLevel lower bound', async () => {
      await service.findByReadingLevel('teacher-1', 3);
      expect(qb.where).toHaveBeenCalledWith('student.teacher.id = :teacherId', {
        teacherId: 'teacher-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'student.readingLevel >= :minLevel',
        { minLevel: 3 },
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });

    it('should build a range when both minLevel and maxLevel are given', async () => {
      await service.findByReadingLevel('teacher-1', 2.5, 3.5);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'student.readingLevel >= :minLevel',
        { minLevel: 2.5 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'student.readingLevel <= :maxLevel',
        { maxLevel: 3.5 },
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('findBySkill', () => {
    it('should build a JSONB containment query scoped to the teacher', async () => {
      await service.findBySkill('teacher-1', 'addition');
      expect(qb.where).toHaveBeenCalledWith('student.teacher.id = :teacherId', {
        teacherId: 'teacher-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('student.skills @> :skill', {
        skill: JSON.stringify(['addition']),
      });
    });
  });

  describe('findByLearningDifference', () => {
    it('should build a JSONB containment query scoped to the teacher', async () => {
      await service.findByLearningDifference('teacher-1', 'dyslexia');
      expect(qb.where).toHaveBeenCalledWith('student.teacher.id = :teacherId', {
        teacherId: 'teacher-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        `student.learningDifferences @> :diff`,
        { diff: JSON.stringify([{ type: 'dyslexia' }]) },
      );
    });
  });

  describe('getProgressEntries', () => {
    it('should return progress entries', async () => {
      const mockEntries = [
        { id: 'p1', skillName: 'phonics', score: 85 },
        { id: 'p2', skillName: 'fluency', score: 90 },
      ];
      (progressRepo.find as jest.Mock).mockResolvedValueOnce(mockEntries);
      const result = await service.getProgressEntries('student-1');
      expect(result).toHaveLength(2);
    });

    it('should filter by skill area', async () => {
      await service.getProgressEntries('student-1', 'reading');
      expect(progressRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            skillArea: 'reading',
          }),
        }),
      );
    });
  });
});
