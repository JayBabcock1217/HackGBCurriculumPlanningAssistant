import { BadRequestException } from '@nestjs/common';
import { SuggestionGeneratorService } from './suggestion-generator.service';

const validStudent = {
  id: 's1',
  firstName: 'Sofia',
  lastName: 'Rodriguez',
  gradeLevel: '3rd',
  readingLevel: 2.9,
  mathAbility: 2.5,
  skills: ['phonics', 'addition'],
  iepDetails: null,
  ellStatus: { homeLanguage: 'Spanish', englishProficiency: 'beginner' },
  learningDifferences: [],
  socialEmotionalNotes: null,
  teacherNotes: null,
};

const validCurriculum = {
  id: 'c1',
  title: '3rd Grade Math - Unit 1: Addition',
  subject: 'Math',
  gradeLevel: '3rd',
};

function makeOptionsJson(count: number): string {
  const options = Array.from({ length: count }, (_, i) => ({
    title: `Option ${i + 1}`,
    type: 'lesson_plan',
    summary: `Summary ${i + 1}`,
    content: `Full content for option ${i + 1}.`,
  }));
  return JSON.stringify({ options });
}

describe('SuggestionGeneratorService', () => {
  let service: SuggestionGeneratorService;
  const studentService = { findOne: jest.fn() };
  const curriculumService = { findOne: jest.fn() };
  const suggestionService = { create: jest.fn() };
  const rag = { retrieve: jest.fn() };
  const gateway = { chat: jest.fn() };

  beforeEach(() => {
    studentService.findOne.mockReset();
    curriculumService.findOne.mockReset();
    suggestionService.create.mockReset();
    rag.retrieve.mockReset();
    gateway.chat.mockReset();

    service = new SuggestionGeneratorService(
      studentService as any,
      curriculumService as any,
      suggestionService as any,
      rag as any,
      gateway as any,
    );
  });

  describe('generate', () => {
    it('generates, parses, and persists the requested number of options', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([
        { chunkId: 'ch1', content: 'Add two-digit numbers.', chunkIndex: 0, similarity: 0.9, curriculumId: 'c1' },
      ]);
      gateway.chat.mockResolvedValue({
        content: makeOptionsJson(3),
        model: 'llama3.2:1b',
        usage: { promptTokens: 50, completionTokens: 200 },
      });
      suggestionService.create.mockResolvedValue({ id: 'new-id' });

      const result = await service.generate({
        studentId: 's1',
        curriculumId: 'c1',
        optionCount: 3,
      });

      expect(result.options).toHaveLength(3);
      expect(result.model).toBe('llama3.2:1b');
      expect(result.sources).toHaveLength(1);

      // Each option was persisted via the suggestion service
      expect(suggestionService.create).toHaveBeenCalledTimes(3);
      const firstCall = suggestionService.create.mock.calls[0][0];
      expect(firstCall.studentId).toBe('s1');
      expect(firstCall.curriculumId).toBe('c1');
      expect(firstCall.modelUsed).toBe('llama3.2:1b');
      expect(firstCall.details.sources).toHaveLength(1);
    });

    it('caps optionCount at 5 and floors at 1', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      // Model returns 9 options but we asked for 99 -> capped to 5
      gateway.chat.mockResolvedValue({
        content: makeOptionsJson(9),
        model: 'm',
      });
      suggestionService.create.mockResolvedValue({});

      const result = await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 99 });
      expect(result.options).toHaveLength(5);

      const result2 = await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 0 });
      expect(result2.options).toHaveLength(1);
    });

    it('includes student profile details (ELL, reading level) in the prompt', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({ content: makeOptionsJson(2), model: 'm' });
      suggestionService.create.mockResolvedValue({});

      await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 2 });

      const prompt = gateway.chat.mock.calls[0][0].find((m: any) => m.role === 'user').content;
      expect(prompt).toContain('Sofia Rodriguez');
      expect(prompt).toContain('Reading level: 2.9');
      expect(prompt).toContain('home language Spanish');
      expect(prompt).toContain('beginner');
    });

    it('incorporates the teacher focus when provided', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({ content: makeOptionsJson(1), model: 'm' });
      suggestionService.create.mockResolvedValue({});

      await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 1, focus: 'regrouping' });

      const prompt = gateway.chat.mock.calls[0][0].find((m: any) => m.role === 'user').content;
      expect(prompt).toContain('Teacher focus: regrouping');
    });

    it('handles empty RAG sources (general best-practice path)', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({ content: makeOptionsJson(2), model: 'm' });
      suggestionService.create.mockResolvedValue({});

      const result = await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 2 });

      const prompt = gateway.chat.mock.calls[0][0].find((m: any) => m.role === 'user').content;
      expect(prompt).toContain('No curriculum chunks were retrieved');
      expect(result.sources).toHaveLength(0);
      expect(result.options).toHaveLength(2);
    });

    it('parses JSON wrapped in markdown fences', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({
        content: 'Here are the options:\n```json\n' + makeOptionsJson(2) + '\n```',
        model: 'm',
      });
      suggestionService.create.mockResolvedValue({});

      const result = await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 2 });
      expect(result.options).toHaveLength(2);
    });

    it('throws BadRequestException when the model returns no options', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({ content: 'I cannot help with that.', model: 'm' });

      await expect(
        service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when student or curriculum is missing', async () => {
      studentService.findOne.mockRejectedValue(new Error('not found'));
      await expect(
        service.generate({ studentId: 'missing', curriculumId: 'c1' }),
      ).rejects.toThrow();
    });

    it('validates option types, defaulting unknown types to lesson_plan', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({
        content: JSON.stringify({
          options: [
            { title: 'A', type: 'bogus_type', summary: 's', content: 'c' },
            { title: 'B', type: 'activity', summary: 's', content: 'c' },
          ],
        }),
        model: 'm',
      });
      suggestionService.create.mockResolvedValue({});

      const result = await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 2 });
      expect(result.options[0].type).toBe('lesson_plan');
      expect(result.options[1].type).toBe('activity');
    });
  });

  describe('parseOptionsJson (via generate)', () => {
    it('truncates to the requested option count', async () => {
      studentService.findOne.mockResolvedValue(validStudent);
      curriculumService.findOne.mockResolvedValue(validCurriculum);
      rag.retrieve.mockResolvedValue([]);
      gateway.chat.mockResolvedValue({ content: makeOptionsJson(5), model: 'm' });
      suggestionService.create.mockResolvedValue({});

      const result = await service.generate({ studentId: 's1', curriculumId: 'c1', optionCount: 2 });
      expect(result.options).toHaveLength(2);
    });
  });
});
