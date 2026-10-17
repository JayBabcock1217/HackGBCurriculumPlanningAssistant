import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuggestionService } from './suggestion.service';
import { Suggestion } from './suggestion.entity';
import { NotFoundException } from '@nestjs/common';

describe('SuggestionService', () => {
  let service: SuggestionService;
  let suggestionRepo: Repository<Suggestion>;

  const mockSuggestion = {
    id: 'suggestion-1',
    type: 'lesson_plan' as const,
    content: 'A personalized lesson plan for fraction addition',
    title: 'Fraction Addition - Level 2',
    details: { duration: '45 min', materials: ['worksheet'] },
    status: 'pending' as const,
    modelUsed: 'ollama/llama3',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSuggestionRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => ({ ...entity, id: 'suggestion-1' })),
      find: jest.fn(() => [mockSuggestion]),
      findOne: jest.fn(() => mockSuggestion),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionService,
        {
          provide: getRepositoryToken(Suggestion),
          useValue: mockSuggestionRepo,
        },
      ],
    }).compile();

    service = module.get<SuggestionService>(SuggestionService);
    suggestionRepo = module.get<Repository<Suggestion>>(
      getRepositoryToken(Suggestion),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a suggestion', async () => {
      const result = await service.create({
        type: 'lesson_plan',
        content: 'Lesson plan content',
        title: 'My Lesson',
        studentId: 'student-1',
        curriculumId: 'curriculum-1',
      });
      expect(suggestionRepo.save).toHaveBeenCalled();
      expect(result.type).toBe('lesson_plan');
    });

    it('should create without curriculum', async () => {
      const result = await service.create({
        type: 'activity',
        content: 'Activity content',
        studentId: 'student-1',
      });
      expect(result.curriculum).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return all suggestions', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by studentId', async () => {
      await service.findAll('student-1');
      expect(suggestionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { id: 'student-1' },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      await service.findAll(undefined, undefined, 'pending');
      expect(suggestionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a suggestion by id', async () => {
      const result = await service.findOne('suggestion-1');
      expect(result.id).toBe('suggestion-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (suggestionRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a suggestion', async () => {
      const result = await service.update('suggestion-1', {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('updateStatus', () => {
    it('should update suggestion status to accepted', async () => {
      const result = await service.updateStatus('suggestion-1', 'accepted');
      expect(result.status).toBe('accepted');
    });

    it('should update suggestion status to rejected', async () => {
      const result = await service.updateStatus('suggestion-1', 'rejected');
      expect(result.status).toBe('rejected');
    });

    it('should update suggestion status to modified', async () => {
      const result = await service.updateStatus('suggestion-1', 'modified');
      expect(result.status).toBe('modified');
    });
  });

  describe('remove', () => {
    it('should delete a suggestion', async () => {
      await service.remove('suggestion-1');
      expect(suggestionRepo.remove).toHaveBeenCalled();
    });
  });
});
