import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgressService } from './progress.service';
import { ProgressEntry } from './progress-entry.entity';
import { Student } from './student.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProgressController } from './progress.controller';

function entry(
  overrides: Partial<ProgressEntry> & { skillName: string; score: number; maxScore?: number },
): ProgressEntry {
  return {
    id: Math.random().toString(36).slice(2),
    skillArea: 'math',
    notes: null,
    createdAt: new Date(),
    student: { id: 'student-1' } as any,
    ...overrides,
  } as ProgressEntry;
}

function student(overrides: Partial<Student> & { id: string; firstName: string; lastName: string }): Student {
  return {
    gradeLevel: '3rd',
    ...overrides,
  } as Student;
}

describe('ProgressService', () => {
  let service: ProgressService;
  let progressRepo: Repository<ProgressEntry>;
  let studentRepo: Repository<Student>;

  beforeEach(async () => {
    const mockStudentRepo = {
      find: jest.fn(() => []),
      findOne: jest.fn(() => null),
    };
    const mockProgressRepo = {
      find: jest.fn(() => []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(ProgressEntry), useValue: mockProgressRepo },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
    studentRepo = module.get<Repository<Student>>(getRepositoryToken(Student));
    progressRepo = module.get<Repository<ProgressEntry>>(getRepositoryToken(ProgressEntry));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('studentTimeline', () => {
    it('should throw NotFoundException for an unknown student', async () => {
      (studentRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.studentTimeline('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return all entries in chronological order with computed percents', async () => {
      (studentRepo.findOne as jest.Mock).mockResolvedValueOnce(
        student({ id: 'student-1', firstName: 'Ava', lastName: 'Patel' }),
      );
      const t = (iso: string) => new Date(iso);
      (progressRepo.find as jest.Mock).mockResolvedValueOnce([
        entry({ skillName: 'addition', score: 60, maxScore: 100, createdAt: t('2026-09-01T10:00:00Z') }),
        entry({ skillName: 'addition', score: 80, maxScore: 100, createdAt: t('2026-09-08T10:00:00Z') }),
        entry({ skillName: 'fraction', score: 5, maxScore: 10, createdAt: t('2026-09-15T10:00:00Z') }),
        entry({ skillName: 'fraction', score: 9, maxScore: 10, createdAt: t('2026-09-22T10:00:00Z') }),
        entry({ skillName: 'phonics', score: 7, maxScore: 100, skillArea: 'reading', createdAt: t('2026-09-29T10:00:00Z') }),
      ]);

      const result = await service.studentTimeline('student-1');

      expect(result.student).toEqual({
        id: 'student-1',
        firstName: 'Ava',
        lastName: 'Patel',
        gradeLevel: '3rd',
      });
      expect(result.entries).toHaveLength(5);
      expect(result.entries.map((e) => e.skillName)).toEqual([
        'addition',
        'addition',
        'fraction',
        'fraction',
        'phonics',
      ]);
      // Percent is computed against maxScore (5/10 -> 50), capped at 100
      expect(result.entries.map((e) => e.percent)).toEqual([60, 80, 50, 90, 7]);
    });

    it('should treat a missing maxScore as 100 and never exceed 100 percent', async () => {
      (studentRepo.findOne as jest.Mock).mockResolvedValueOnce(
        student({ id: 'student-1', firstName: 'Ava', lastName: 'Patel' }),
      );
      (progressRepo.find as jest.Mock).mockResolvedValueOnce([
        entry({ skillName: 'addition', score: 120, maxScore: undefined }),
      ]);
      const result = await service.studentTimeline('student-1');
      expect(result.entries[0].percent).toBe(100);
    });

    it('should average per-skill mastery across all entries', async () => {
      (studentRepo.findOne as jest.Mock).mockResolvedValueOnce(
        student({ id: 'student-1', firstName: 'Ava', lastName: 'Patel' }),
      );
      (progressRepo.find as jest.Mock).mockResolvedValueOnce([
        entry({ skillName: 'addition', score: 60, maxScore: 100, skillArea: 'math' }),
        entry({ skillName: 'addition', score: 80, maxScore: 100, skillArea: 'math' }),
        entry({ skillName: 'fraction', score: 90, maxScore: 100, skillArea: 'math' }),
      ]);
      const result = await service.studentTimeline('student-1');
      expect(result.skillAverages).toEqual([
        { skill: 'fraction', skillArea: 'math', percent: 90, entries: 1 },
        { skill: 'addition', skillArea: 'math', percent: 70, entries: 2 },
      ]);
    });

    it('should return an empty timeline for a new student with no entries', async () => {
      (studentRepo.findOne as jest.Mock).mockResolvedValueOnce(
        student({ id: 'newbie', firstName: 'Noah', lastName: 'New' }),
      );
      (progressRepo.find as jest.Mock).mockResolvedValueOnce([]);
      const result = await service.studentTimeline('newbie');
      expect(result.entries).toHaveLength(0);
      expect(result.skillAverages).toHaveLength(0);
    });
  });

  describe('classTimeline', () => {
    const students = [
      student({ id: 's1', firstName: 'Ava', lastName: 'Patel' }),
      student({ id: 's2', firstName: 'Noah', lastName: 'Williams' }),
      student({ id: 's3', firstName: 'New', lastName: 'Student' }),
    ];

    it('should aggregate per-student summaries and class skill mastery', async () => {
      (studentRepo.find as jest.Mock).mockResolvedValueOnce(students);
      (progressRepo.find as jest.Mock).mockResolvedValueOnce([
        // Ava: two entries on different days
        { ...entry({ id: 'e1', skillName: 'addition', score: 80, maxScore: 100, createdAt: new Date('2026-09-01T10:00:00Z') }), student: { id: 's1' } },
        { ...entry({ id: 'e2', skillName: 'fraction', score: 50, maxScore: 100, createdAt: new Date('2026-09-02T10:00:00Z') }), student: { id: 's1' } },
        // Noah: one entry, same first day
        { ...entry({ id: 'e3', skillName: 'addition', score: 40, maxScore: 100, createdAt: new Date('2026-09-01T11:00:00Z') }), student: { id: 's2' } },
      ]);

      const result = await service.classTimeline('teacher-1');

      expect(result.teacherId).toBe('teacher-1');
      expect(result.students).toHaveLength(3);
      expect(result.students[0]).toEqual({
        id: 's1',
        firstName: 'Ava',
        lastName: 'Patel',
        entryCount: 2,
        latestPercent: 50,
        latest: expect.objectContaining({ skillName: 'fraction', percent: 50 }),
      });
      expect(result.students[1]).toEqual({
        id: 's2',
        firstName: 'Noah',
        lastName: 'Williams',
        entryCount: 1,
        latestPercent: 40,
        latest: expect.objectContaining({ skillName: 'addition', percent: 40 }),
      });
      // New student: no data yet
      expect(result.students[2]).toEqual({
        id: 's3',
        firstName: 'New',
        lastName: 'Student',
        entryCount: 0,
        latestPercent: null,
        latest: null,
      });

      // Class skill mastery: addition = (80+40)/2 = 60, fraction = 50
      expect(result.skillAverages).toEqual([
        { skill: 'addition', percent: 60, entries: 2 },
        { skill: 'fraction', percent: 50, entries: 1 },
      ]);

      // Over time: day 1 = (80+40)/2 = 60, day 2 = 50
      expect(result.overTime).toEqual([
        { date: '2026-09-01', percent: 60, entries: 2 },
        { date: '2026-09-02', percent: 50, entries: 1 },
      ]);
    });

    it('should return an empty timeline for a teacher with no students', async () => {
      (studentRepo.find as jest.Mock).mockResolvedValueOnce([]);
      const result = await service.classTimeline('teacher-empty');
      expect(result.students).toHaveLength(0);
      expect(result.skillAverages).toHaveLength(0);
      expect(result.overTime).toHaveLength(0);
      // No students -> no entries query needed
      expect(progressRepo.find).not.toHaveBeenCalled();
    });
  });
});

describe('ProgressController', () => {
  let controller: ProgressController;
  let service: ProgressService;

  beforeEach(async () => {
    service = {
      studentTimeline: jest.fn(),
      classTimeline: jest.fn(),
    } as any;
    controller = new ProgressController(service);
  });

  it('should delegate the student timeline to the service', async () => {
    const timeline = { student: { id: 's1' } } as any;
    (service.studentTimeline as jest.Mock).mockResolvedValue(timeline);
    await expect(controller.studentTimeline('s1')).resolves.toBe(timeline);
    expect(service.studentTimeline).toHaveBeenCalledWith('s1');
  });

  it('should delegate the class timeline to the service', async () => {
    const timeline = { teacherId: 't1' } as any;
    (service.classTimeline as jest.Mock).mockResolvedValue(timeline);
    await expect(controller.classTimeline('t1')).resolves.toBe(timeline);
    expect(service.classTimeline).toHaveBeenCalledWith('t1');
  });

  it('should reject a class timeline request without teacherId', async () => {
    await expect(controller.classTimeline('')).rejects.toThrow(BadRequestException);
    expect(service.classTimeline).not.toHaveBeenCalled();
  });
});
