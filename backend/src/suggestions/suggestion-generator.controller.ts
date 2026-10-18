import { Body, Controller, Post } from '@nestjs/common';
import {
  SuggestionGeneratorService,
  GenerateSuggestionsOptions,
} from './suggestion-generator.service';

/**
 * SuggestionGeneratorController (Chunk 7)
 *
 *   POST /api/suggestions/generate — generate personalized lesson options
 *
 * (List/fetch/update/delete of individual suggestions live on the existing
 * SuggestionController from Chunk 2, also on the /suggestions path.)
 */
@Controller('suggestions')
export class SuggestionGeneratorController {
  constructor(private readonly generator: SuggestionGeneratorService) {}

  @Post('generate')
  generate(@Body() body: GenerateSuggestionsOptions) {
    if (!body?.studentId || !body?.curriculumId) {
      throw new Error('studentId and curriculumId are required');
    }
    return this.generator.generate({
      studentId: body.studentId,
      curriculumId: body.curriculumId,
      optionCount: body.optionCount,
      focus: body.focus,
      maxTokens: body.maxTokens,
    });
  }
}
