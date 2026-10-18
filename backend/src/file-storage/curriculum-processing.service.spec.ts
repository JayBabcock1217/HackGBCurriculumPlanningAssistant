import { Test, TestingModule } from '@nestjs/testing';
import { CurriculumProcessingService } from './curriculum-processing.service';
import { FileStorageService } from './file-storage.service';
import { DocumentParserService } from './document-parser.service';
import { TextChunkingService } from './text-chunking.service';
import { EmbeddingService } from './embedding.service';
import { CurriculumService } from '../database/curriculum/curriculum.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

describe('CurriculumProcessingService', () => {
  let service: CurriculumProcessingService;
  let fileStorage: jest.Mocked<FileStorageService>;
  let parser: jest.Mocked<DocumentParserService>;
  let chunker: jest.Mocked<TextChunkingService>;
  let embedder: jest.Mocked<EmbeddingService>;
  let curriculumService: jest.Mocked<CurriculumService>;
  let gateway: { embedBatch: jest.Mock; embed: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumProcessingService,
        {
          provide: FileStorageService,
          useValue: {
            uploadFile: jest.fn(),
            downloadFile: jest.fn(),
            deleteFile: jest.fn(),
            fileExists: jest.fn(),
            listFiles: jest.fn(),
          },
        },
        {
          provide: DocumentParserService,
          useValue: {
            parse: jest.fn(),
          },
        },
        {
          provide: TextChunkingService,
          useValue: {
            chunkText: jest.fn(),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embedText: jest.fn(),
            embedBatch: jest.fn(),
          },
        },
        {
          provide: CurriculumService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            addChunks: jest.fn(),
            searchByEmbedding: jest.fn(),
          },
        },
        {
          provide: LlmGatewayService,
          useValue: {
            embed: jest.fn(),
            embedBatch: jest.fn(),
            chat: jest.fn(),
            listProviders: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CurriculumProcessingService);
    fileStorage = module.get(FileStorageService) as jest.Mocked<FileStorageService>;
    parser = module.get(DocumentParserService) as jest.Mocked<DocumentParserService>;
    chunker = module.get(TextChunkingService) as jest.Mocked<TextChunkingService>;
    embedder = module.get(EmbeddingService) as jest.Mocked<EmbeddingService>;
    curriculumService = module.get(
      CurriculumService,
    ) as jest.Mocked<CurriculumService>;
    gateway = module.get(LlmGatewayService) as unknown as {
      embedBatch: jest.Mock;
      embed: jest.Mock;
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processCurriculum', () => {
    const sampleText =
      'Lesson 1: Introduction to fractions.\n\n' +
      'A fraction represents a part of a whole.\n\n'.repeat(10);

    const setupMocks = () => {
      fileStorage.uploadFile.mockResolvedValue('curricula/teacher-1/file.pdf');
      parser.parse.mockResolvedValue({
        text: sampleText,
        pages: 3,
        metadata: { title: 'Fractions Unit' },
      });
      const chunks = [
        {
          content: 'chunk one',
          chunkIndex: 0,
          tokenCount: 100,
          metadata: { startIndex: 0, endIndex: 1500 },
        },
        {
          content: 'chunk two',
          chunkIndex: 1,
          tokenCount: 90,
          metadata: { startIndex: 1300, endIndex: 2500 },
        },
      ];
      chunker.chunkText.mockReturnValue(chunks);
      // Chunk 5: embeddings now come from the LLM gateway (real model),
      // not the legacy pseudo-embedder.
      gateway.embedBatch.mockResolvedValue(
        chunks.map(() => ({
          embedding: [0.1, 0.2, 0.3],
          model: 'test-model',
          tokenCount: 50,
          dimensions: 3,
        })),
      );
      curriculumService.create.mockResolvedValue({
        id: 'curriculum-1',
        title: 'Fractions Unit',
      } as any);
      curriculumService.addChunks.mockResolvedValue([]);
    };

    it('should run the full pipeline: upload → parse → create → chunk → embed → store', async () => {
      setupMocks();

      const result = await service.processCurriculum({
        teacherId: 'teacher-1',
        title: 'Fractions Unit',
        subject: 'Math',
        gradeLevel: '3rd',
        fileName: 'fractions.pdf',
        fileType: 'pdf',
        fileBuffer: Buffer.from('fake-pdf'),
      });

      expect(fileStorage.uploadFile).toHaveBeenCalledTimes(1);
      expect(parser.parse).toHaveBeenCalledWith(
        Buffer.from('fake-pdf'),
        'pdf',
      );
      expect(curriculumService.create).toHaveBeenCalledTimes(1);
      const createArgs = curriculumService.create.mock.calls[0][0] as any;
      expect(createArgs.title).toBe('Fractions Unit');
      expect(createArgs.teacherId).toBe('teacher-1');
      expect(createArgs.fileType).toBe('pdf');
      expect(createArgs.fileUrl).toContain('curricula/teacher-1/');
      expect(chunker.chunkText).toHaveBeenCalledWith(sampleText);
      expect(gateway.embedBatch).toHaveBeenCalledTimes(1);
      expect(embedder.embedBatch).not.toHaveBeenCalled();
      expect(curriculumService.addChunks).toHaveBeenCalledTimes(1);

      const addChunksArgs = curriculumService.addChunks.mock.calls[0];
      expect(addChunksArgs[0]).toBe('curriculum-1');
      expect(addChunksArgs[1]).toHaveLength(2);
      // Embeddings should be serialized as pgvector text format
      expect(addChunksArgs[1][0].embedding).toBe('[0.1,0.2,0.3]');

      expect(result.curriculumId).toBe('curriculum-1');
      expect(result.totalChunks).toBe(2);
      expect(result.totalCharacters).toBe(sampleText.length);
      expect(result.totalPages).toBe(3);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use correct content type for PDF uploads', async () => {
      setupMocks();
      await service.processCurriculum({
        teacherId: 't1',
        title: 'Test',
        fileName: 'test.pdf',
        fileType: 'pdf',
        fileBuffer: Buffer.from('x'),
      });
      const uploadCall = fileStorage.uploadFile.mock.calls[0];
      expect(uploadCall[2]).toBe('application/pdf');
    });

    it('should use correct content type for Word uploads', async () => {
      setupMocks();
      await service.processCurriculum({
        teacherId: 't1',
        title: 'Test',
        fileName: 'test.docx',
        fileType: 'word',
        fileBuffer: Buffer.from('x'),
      });
      const uploadCall = fileStorage.uploadFile.mock.calls[0];
      expect(uploadCall[2]).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('should include parsed metadata in the curriculum record', async () => {
      setupMocks();
      await service.processCurriculum({
        teacherId: 't1',
        title: 'Test',
        fileName: 'test.pdf',
        fileType: 'pdf',
        fileBuffer: Buffer.from('x'),
        metadata: { custom: 'value' },
      });
      const createArgs = curriculumService.create.mock.calls[0][0] as any;
      expect(createArgs.metadata.custom).toBe('value');
      expect(createArgs.metadata.title).toBe('Fractions Unit');
      expect(createArgs.metadata.totalCharacters).toBe(sampleText.length);
      expect(createArgs.metadata.totalPages).toBe(3);
    });

    it('should store embedding model in chunk metadata', async () => {
      setupMocks();
      await service.processCurriculum({
        teacherId: 't1',
        title: 'Test',
        fileName: 'test.pdf',
        fileType: 'pdf',
        fileBuffer: Buffer.from('x'),
      });
      const addChunksArgs = curriculumService.addChunks.mock.calls[0];
      const storedChunk = addChunksArgs[1][0] as any;
      expect(storedChunk.metadata.embeddingModel).toBe('test-model');
      expect(storedChunk.metadata.startIndex).toBe(0);
    });
  });

  describe('searchCurriculum', () => {
    it('should embed the query via the gateway and search by embedding', async () => {
      gateway.embed.mockResolvedValue({
        embedding: [0.5, 0.5],
        model: 'test-model',
        tokenCount: 10,
        dimensions: 2,
      });
      curriculumService.searchByEmbedding.mockResolvedValue([]);

      await service.searchCurriculum('fractions lesson', 'cur-1', 5);

      expect(gateway.embed).toHaveBeenCalledWith('fractions lesson');
      expect(embedder.embedText).not.toHaveBeenCalled();
      expect(curriculumService.searchByEmbedding).toHaveBeenCalledWith(
        [0.5, 0.5],
        'cur-1',
        5,
      );
    });

    it('should use default limit of 10', async () => {
      gateway.embed.mockResolvedValue({
        embedding: [0.1],
        model: 'test-model',
        tokenCount: 5,
        dimensions: 1,
      });
      curriculumService.searchByEmbedding.mockResolvedValue([]);

      await service.searchCurriculum('division');

      expect(curriculumService.searchByEmbedding).toHaveBeenCalledWith(
        [0.1],
        undefined,
        10,
      );
    });
  });

  describe('deleteCurriculum', () => {
    it('should delete the file and the curriculum record', async () => {
      curriculumService.findOne.mockResolvedValue({
        id: 'cur-1',
        fileUrl: 'curricula/t1/file.pdf',
      } as any);
      fileStorage.deleteFile.mockResolvedValue(undefined);
      curriculumService.remove.mockResolvedValue(undefined);

      await service.deleteCurriculum('cur-1');

      expect(fileStorage.deleteFile).toHaveBeenCalledWith(
        'curricula/t1/file.pdf',
      );
      expect(curriculumService.remove).toHaveBeenCalledWith('cur-1');
    });

    it('should skip file deletion when no file exists', async () => {
      curriculumService.findOne.mockResolvedValue({
        id: 'cur-1',
        fileUrl: null,
      } as any);
      curriculumService.remove.mockResolvedValue(undefined);

      await service.deleteCurriculum('cur-1');

      expect(fileStorage.deleteFile).not.toHaveBeenCalled();
      expect(curriculumService.remove).toHaveBeenCalledWith('cur-1');
    });
  });
});
