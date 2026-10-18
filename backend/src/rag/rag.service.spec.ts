import { BadRequestException } from '@nestjs/common';
import { RagService } from './rag.service';

describe('RagService', () => {
  let service: RagService;
  const gateway = {
    embed: jest.fn(),
    chat: jest.fn(),
  };
  const curriculumService = {
    searchByEmbedding: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(() => {
    gateway.embed.mockReset();
    gateway.chat.mockReset();
    curriculumService.searchByEmbedding.mockReset();
    curriculumService.findOne.mockReset();

    service = new RagService(gateway as any, curriculumService as any);
  });

  describe('retrieve', () => {
    it('embeds the query and filters by similarity threshold', async () => {
      gateway.embed.mockResolvedValue({ embedding: [0.1, 0.2], model: 'm', dimensions: 2 });
      curriculumService.searchByEmbedding.mockResolvedValue([
        { id: 'c1', content: 'addition facts', chunkIndex: 0, distance: 0.1, curriculum: { id: 'cur1' } },
        { id: 'c2', content: 'quantum physics', chunkIndex: 1, distance: 0.9, curriculum: { id: 'cur1' } },
      ]);

      const sources = await service.retrieve('how do we add numbers?', { minSimilarity: 0.25 });

      expect(gateway.embed).toHaveBeenCalledWith('how do we add numbers?');
      // Only the close chunk (distance 0.1 => similarity 0.9) survives the 0.25 threshold
      expect(sources).toHaveLength(1);
      expect(sources[0].chunkId).toBe('c1');
      expect(sources[0].similarity).toBeCloseTo(0.9, 1);
    });

    it('returns empty when nothing passes the threshold', async () => {
      gateway.embed.mockResolvedValue({ embedding: [0.1], model: 'm', dimensions: 1 });
      curriculumService.searchByEmbedding.mockResolvedValue([
        { id: 'c1', content: 'unrelated', chunkIndex: 0, distance: 0.99, curriculum: { id: 'x' } },
      ]);

      const sources = await service.retrieve('query');
      expect(sources).toHaveLength(0);
    });
  });

  describe('ask', () => {
    it('builds a grounded prompt with sources and student context', async () => {
      gateway.embed.mockResolvedValue({ embedding: [0.1], model: 'm', dimensions: 1 });
      curriculumService.searchByEmbedding.mockResolvedValue([
        { id: 'c1', content: 'Add two-digit numbers with regrouping.', chunkIndex: 3, distance: 0.2, curriculum: { id: 'cur1' } },
      ]);
      curriculumService.findOne.mockResolvedValue({ id: 'cur1', title: 'Math Unit 1' });
      gateway.chat.mockResolvedValue({
        content: 'Add with regrouping [1].',
        model: 'llama3.2:1b',
        usage: { promptTokens: 10, completionTokens: 5 },
      });

      const result = await service.ask('how to add?', {
        systemContext: 'Reading 2.9, ELL Spanish',
      });

      // The system prompt must contain the retrieved chunk and the student context
      const call = gateway.chat.mock.calls[0][0];
      const systemMsg = call.find((m: any) => m.role === 'system');
      expect(systemMsg.content).toContain('Add two-digit numbers with regrouping');
      expect(systemMsg.content).toContain('Reading 2.9, ELL Spanish');
      expect(systemMsg.content).toContain('[Source 1]');

      expect(result.answer).toBe('Add with regrouping [1].');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].curriculumTitle).toBe('Math Unit 1');
      expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
    });

    it('handles the no-relevant-chunks edge case gracefully', async () => {
      gateway.embed.mockResolvedValue({ embedding: [0.1], model: 'm', dimensions: 1 });
      curriculumService.searchByEmbedding.mockResolvedValue([
        { id: 'c1', content: 'noise', chunkIndex: 0, distance: 0.99, curriculum: { id: 'x' } },
      ]);
      gateway.chat.mockResolvedValue({
        content: 'No relevant curriculum found. General tip: ...',
        model: 'llama3.2:1b',
      });

      const result = await service.ask('query');

      expect(result.sources).toHaveLength(0);
      // The "no context" path still calls chat, with a system prompt noting no context
      const call = gateway.chat.mock.calls[0][0];
      const systemMsg = call.find((m: any) => m.role === 'system');
      expect(systemMsg.content).toContain('NO relevant curriculum context');
    });
  });

  describe('validateQuery', () => {
    it('throws BadRequestException for empty queries', () => {
      expect(() => RagService.validateQuery('')).toThrow(BadRequestException);
      expect(() => RagService.validateQuery('   ')).toThrow(BadRequestException);
    });
  });
});
