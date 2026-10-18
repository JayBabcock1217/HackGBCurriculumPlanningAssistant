import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  SuggestionGeneratorService,
  GenerateSuggestionsOptions,
  GenerateSuggestionsResult,
} from './suggestion-generator.service';
import { CurrentUser } from '../database/auth/current-user.decorator';
import type { SafeUser } from '../database/auth/auth.service';

/**
 * SuggestionGeneratorController (Chunk 7)
 *
 *   POST /api/suggestions/generate — generate personalized lesson options
 *   POST /api/suggestions/generate/start — start a background resource job
 *   GET  /api/suggestions/generate/status/:id — poll a background job
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
      language: body.language,
    });
  }

  /**
   * Chunk 12: start a background resource-generation job. Returns the job id
   * immediately so the client can navigate away; the LLM work continues
   * server-side and is tracked via the status endpoint.
   */
  @Post('generate/start')
  async start(
    @Body() body: GenerateSuggestionsOptions,
    @CurrentUser() user: SafeUser,
  ): Promise<{ jobId: string }> {
    if (!body?.studentId || !body?.curriculumId) {
      throw new Error('studentId and curriculumId are required');
    }
    const jobId = await this.generator.startJob(
      {
        studentId: body.studentId,
        curriculumId: body.curriculumId,
        optionCount: body.optionCount,
        focus: body.focus,
        maxTokens: body.maxTokens,
        language: body.language,
        kind: body.kind,
      },
      user.id,
    );
    return { jobId };
  }

  /** Chunk 12: poll a background generation job (owner-only). */
  @Get('generate/status/:id')
  status(
    @Param('id') id: string,
    @CurrentUser() user: SafeUser,
  ): Promise<GenerateSuggestionsResult> {
    return this.generator.jobStatus(id, user.id);
  }
}
