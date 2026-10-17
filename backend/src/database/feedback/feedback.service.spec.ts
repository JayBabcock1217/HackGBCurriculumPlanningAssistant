import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackService } from './feedback.service';
import { Feedback } from './feedback.entity';
import { NotFoundException } from '@nestjs/common';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackRepo: Repository<Feedback>;

  const mockFeedback = {
    id: 'feedback-1',
    action: 'rejected' as const,
    reason: 'Too advanced for the student',
    teacherComment: 'Student is not ready for this material',
    modifiedContent: null,
    embedding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockFeedbackRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => ({ ...entity, id: 'feedback-1' })),
      find: jest.fn(() => [mockFeedback]),
      findOne: jest.fn(() => mockFeedback),
      remove: jest.fn(),
      query: jest.fn(() => []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(Feedback),
          useValue: mockFeedbackRepo,
        },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    feedbackRepo = module.get<Repository<Feedback>>(
      getRepositoryToken(Feedback),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create feedback for a suggestion', async () => {
      const result = await service.create({
        action: 'rejected',
        reason: 'Too advanced',
        teacherComment: 'Student needs simpler material',
        suggestionId: 'suggestion-1',
        teacherId: 'teacher-1',
      });
      expect(feedbackRepo.save).toHaveBeenCalled();
      expect(result.action).toBe('rejected');
    });

    it('should create modified feedback with modifiedContent', async () => {
      await service.create({
        action: 'modified',
        reason: 'Adjusted difficulty',
        modifiedContent: 'Simplified lesson plan...',
        suggestionId: 'suggestion-1',
        teacherId: 'teacher-1',
      });
      expect(feedbackRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all feedback', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by teacherId', async () => {
      await service.findAll('teacher-1');
      expect(feedbackRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teacher: { id: 'teacher-1' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return feedback by id', async () => {
      const result = await service.findOne('feedback-1');
      expect(result.id).toBe('feedback-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (feedbackRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update feedback (teacher can edit at any time)', async () => {
      const result = await service.update('feedback-1', {
        reason: 'Updated reason',
        teacherComment: 'Revised comment',
      });
      expect(result.reason).toBe('Updated reason');
      expect(feedbackRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete feedback', async () => {
      await service.remove('feedback-1');
      expect(feedbackRepo.remove).toHaveBeenCalled();
    });
  });

  describe('findBySuggestion', () => {
    it('should find feedback for a specific suggestion', async () => {
      const result = await service.findBySuggestion('suggestion-1');
      expect(result).toEqual(mockFeedback);
    });

    it('should return null if no feedback exists', async () => {
      (feedbackRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      const result = await service.findBySuggestion('suggestion-1');
      expect(result).toBeNull();
    });
  });

  describe('searchByEmbedding', () => {
    it('should perform vector similarity search on feedback', async () => {
      const mockResult = [
        {
          id: 'feedback-1',
          action: 'rejected',
          reason: 'Too advanced',
          teacher_comment: 'Needs simpler material',
          modified_content: null,
          embedding: '[1,2,3]',
          created_at: new Date(),
          updated_at: new Date(),
          suggestion_id: 'suggestion-1',
          teacher_id: 'teacher-1',
          similarity: '0.92',
        },
      ];
      (feedbackRepo.query as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await service.searchByEmbedding(
        [1, 2, 3],
        'teacher-1',
        5,
      );
      expect(feedbackRepo.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBeCloseTo(0.92);
    });
  });
});
