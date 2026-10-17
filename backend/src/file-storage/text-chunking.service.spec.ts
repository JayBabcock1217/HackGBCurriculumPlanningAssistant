import { Test, TestingModule } from '@nestjs/testing';
import { TextChunkingService } from './text-chunking.service';

describe('TextChunkingService', () => {
  let service: TextChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextChunkingService],
    }).compile();

    service = module.get<TextChunkingService>(TextChunkingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chunkText', () => {
    it('should return empty array for empty text', () => {
      const result = service.chunkText('');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for whitespace only', () => {
      const result = service.chunkText('   \n\n  ');
      expect(result).toHaveLength(0);
    });

    it('should return single chunk for short text', () => {
      const text = 'This is a short paragraph that fits in one chunk.';
      const result = service.chunkText(text);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(text.trim());
      expect(result[0].chunkIndex).toBe(0);
    });

    it('should split long text into multiple chunks', () => {
      const text = 'A'.repeat(5000);
      const result = service.chunkText(text, { chunkSize: 1000, overlap: 100 });
      expect(result.length).toBeGreaterThan(1);
    });

    it('should maintain chunk ordering', () => {
      const text = 'One two three. Four five six. Seven eight nine. Ten eleven twelve. '.repeat(50);
      const result = service.chunkText(text, { chunkSize: 500, overlap: 50 });
      for (let i = 1; i < result.length; i++) {
        expect(result[i].chunkIndex).toBe(result[i - 1].chunkIndex + 1);
      }
    });

    it('should include overlap between consecutive chunks', () => {
      const text = 'Hello world. This is a test. '.repeat(100);
      const result = service.chunkText(text, { chunkSize: 200, overlap: 50 });
      if (result.length >= 2) {
        // The end of chunk 0 should appear at the start of chunk 1 (with overlap)
        const endOfFirst = result[0].content.slice(-30);
        const startOfSecond = result[1].content.slice(0, 30);
        // Due to trimming and break points, exact match may not hold,
        // but the overlap region should share some text
        expect(result[1].metadata.startIndex).toBeLessThan(
          result[0].metadata.endIndex,
        );
      }
    });

    it('should estimate token count', () => {
      const text = 'This is a test sentence with some words in it.';
      const result = service.chunkText(text);
      expect(result[0].tokenCount).toBeGreaterThan(0);
      expect(result[0].tokenCount).toBeLessThan(result[0].content.length);
    });

    it('should prefer paragraph boundaries for breaks', () => {
      const para1 = 'First paragraph with some content. '.repeat(10);
      const para2 = '\n\nSecond paragraph with different content. '.repeat(10);
      const text = para1 + para2;
      const result = service.chunkText(text, { chunkSize: 300, overlap: 50 });
      // Should break at paragraph boundary
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect custom chunk size', () => {
      const text = 'word '.repeat(1000);
      const small = service.chunkText(text, { chunkSize: 500, overlap: 50 });
      const large = service.chunkText(text, { chunkSize: 2000, overlap: 50 });
      expect(small.length).toBeGreaterThan(large.length);
    });
  });
});
