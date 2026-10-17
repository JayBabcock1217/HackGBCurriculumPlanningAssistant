import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('embedText', () => {
    it('should return an embedding with consistent dimensions', async () => {
      const result = await service.embedText('Hello world');
      expect(result.embedding).toHaveLength(384);
      expect(result.model).toBe('pseudo-embedding-v1');
    });

    it('should return a normalized vector (unit length)', async () => {
      const result = await service.embedText('Test text for normalization');
      const magnitude = Math.sqrt(
        result.embedding.reduce((sum, val) => sum + val * val, 0),
      );
      expect(magnitude).toBeCloseTo(1, 1);
    });

    it('should produce deterministic embeddings', async () => {
      const result1 = await service.embedText('Same text');
      const result2 = await service.embedText('Same text');
      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should produce different embeddings for different texts', async () => {
      const result1 = await service.embedText('Math lesson about fractions');
      const result2 = await service.embedText('Science lesson about photosynthesis');
      expect(result1.embedding).not.toEqual(result2.embedding);
    });

    it('should produce similar embeddings for similar texts', async () => {
      const result1 = await service.embedText(
        'Fraction addition with visual fraction bars',
      );
      const result2 = await service.embedText(
        'Fraction addition using fraction bar manipulatives',
      );
      const result3 = await service.embedText(
        'Advanced calculus integration techniques',
      );

      const sim12 = cosineSimilarity(result1.embedding, result2.embedding);
      const sim13 = cosineSimilarity(result1.embedding, result3.embedding);

      // Similar texts should have higher similarity than dissimilar texts
      expect(sim12).toBeGreaterThan(sim13);
    });

    it('should estimate token count', async () => {
      const result = await service.embedText('A test sentence with words');
      expect(result.tokenCount).toBeGreaterThan(0);
    });
  });

  describe('embedBatch', () => {
    it('should embed multiple texts', async () => {
      const results = await service.embedBatch([
        'First text',
        'Second text',
        'Third text',
      ]);
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.embedding).toHaveLength(384);
      });
    });
  });
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
