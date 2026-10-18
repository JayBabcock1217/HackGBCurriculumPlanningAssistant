import { Body, Controller, Post } from '@nestjs/common';
import { RagService, RagQueryOptions } from './rag.service';

/**
 * RagController (Chunk 5)
 *
 *   POST /api/rag/ask        — full RAG: retrieve + grounded answer + sources
 *   POST /api/rag/retrieve   — retrieval only (preview what the model will see)
 */
@Controller('rag')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Post('ask')
  ask(
    @Body()
    body: RagQueryOptions & {
      query: string;
      systemContext?: string;
      maxTokens?: number;
    },
  ) {
    RagService.validateQuery(body.query);
    return this.rag.ask(body.query, {
      curriculumId: body.curriculumId,
      topK: body.topK,
      minSimilarity: body.minSimilarity,
      systemContext: body.systemContext,
      maxTokens: body.maxTokens,
    });
  }

  @Post('retrieve')
  retrieve(@Body() body: RagQueryOptions & { query: string }) {
    RagService.validateQuery(body.query);
    return this.rag.retrieve(body.query, {
      curriculumId: body.curriculumId,
      topK: body.topK,
      minSimilarity: body.minSimilarity,
    });
  }

  /**
   * POST /api/rag/reembed
   * Re-embed a curriculum's chunks with the current gateway embedding model.
   * Migration path for curricula indexed under a legacy/different model.
   */
  @Post('reembed')
  reembed(@Body() body: { curriculumId: string }) {
    if (!body?.curriculumId) {
      throw new Error('curriculumId is required');
    }
    return this.rag.reembedCurriculum(body.curriculumId);
  }
}
