import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumService } from './curriculum.service';
import { Curriculum } from './curriculum.entity';
import { CurriculumChunk } from './curriculum-chunk.entity';
import { NotFoundException } from '@nestjs/common';

describe('CurriculumService', () => {
  let service: CurriculumService;
  let curriculumRepo: Repository<Curriculum>;
  let chunkRepo: Repository<CurriculumChunk>;

  const mockCurriculum = {
    id: 'test-id',
    title: 'Test Curriculum',
    subject: 'Math',
    gradeLevel: '3rd',
    description: 'A test curriculum',
    fileType: 'pdf' as const,
    fileName: 'test.pdf',
    chunkCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCurriculumRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => ({ ...entity, id: 'test-id' })),
      find: jest.fn(() => [mockCurriculum]),
      findOne: jest.fn(() => mockCurriculum),
      remove: jest.fn(),
    };

    const mockChunkRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entities) => entities),
      find: jest.fn(() => []),
      query: jest.fn(() => []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        {
          provide: getRepositoryToken(Curriculum),
          useValue: mockCurriculumRepo,
        },
        {
          provide: getRepositoryToken(CurriculumChunk),
          useValue: mockChunkRepo,
        },
      ],
    }).compile();

    service = module.get<CurriculumService>(CurriculumService);
    curriculumRepo = module.get<Repository<Curriculum>>(
      getRepositoryToken(Curriculum),
    );
    chunkRepo = module.get<Repository<CurriculumChunk>>(
      getRepositoryToken(CurriculumChunk),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a curriculum', async () => {
      const result = await service.create({
        title: 'New Curriculum',
        fileType: 'pdf',
        fileName: 'test.pdf',
        teacherId: 'teacher-1',
      });
      expect(curriculumRepo.create).toHaveBeenCalled();
      expect(curriculumRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('New Curriculum');
    });
  });

  describe('findAll', () => {
    it('should return all curricula', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Curriculum');
    });

    it('should filter by teacherId', async () => {
      await service.findAll('teacher-1');
      expect(curriculumRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teacher: { id: 'teacher-1' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a curriculum by id', async () => {
      const result = await service.findOne('test-id');
      expect(result.id).toBe('test-id');
    });

    it('should throw NotFoundException if not found', async () => {
      (curriculumRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a curriculum', async () => {
      const result = await service.update('test-id', { title: 'Updated' });
      expect(result.title).toBe('Updated');
      expect(curriculumRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a curriculum', async () => {
      await service.remove('test-id');
      expect(curriculumRepo.remove).toHaveBeenCalled();
    });
  });

  describe('searchByEmbedding', () => {
    it('should perform vector similarity search', async () => {
      const mockResult = [
        {
          id: 'chunk-1',
          content: 'test content',
          chunk_index: 0,
          token_count: 100,
          embedding: '[1,2,3]',
          metadata: {},
          created_at: new Date(),
          curriculum_id: 'test-id',
          similarity: '0.95',
        },
      ];
      (chunkRepo.query as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await service.searchByEmbedding([1, 2, 3], 'test-id', 5);
      expect(chunkRepo.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].distance).toBeCloseTo(0.05);
    });
  });
});
