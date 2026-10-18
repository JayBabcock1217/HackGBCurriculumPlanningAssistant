import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { CurriculumService } from '../database/curriculum/curriculum.service';

export interface RagQueryOptions {
  /** Restrict retrieval to a single curriculum. */
  curriculumId?: string;
  /** Max chunks to retrieve (default 5). */
  topK?: number;
  /**
   * Minimum similarity (0..1) for a chunk to be included. Chunks below this
   * threshold are treated as "no relevant context" (default 0.25).
   */
  minSimilarity?: number;
}

export interface RagResult {
  answer: string;
  model: string;
  sources: Array<{
    chunkId: string;
    content: string;
    chunkIndex: number;
    similarity: number;
    curriculumId: string;
    curriculumTitle: string;
  }>;
  usage?: { promptTokens?: number; completionTokens?: number };
}

/**
 * RagService (Chunk 5)
 *
 * Retrieval-augmented generation:
 *   1. Embed the query (LLM Gateway, real embeddings)
 *   2. Retrieve the most similar curriculum chunks (pgvector)
 *   3. Build a grounded prompt from student context + retrieved chunks
 *   4. Generate the answer (LLM Gateway chat)
 *   5. Return the answer with its sources, so callers can show
 *      "where this came from" in the UI.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly curriculumService: CurriculumService,
  ) {}

  /**
   * Re-embed ALL chunks of a curriculum using the current gateway embedding
   * model. This is the migration path for curricula that were indexed with a
   * different (e.g. legacy pseudo) embedding model, so that pgvector
   * comparisons stay dimension-consistent.
   */
  async reembedCurriculum(curriculumId: string): Promise<{
    curriculumId: string;
    chunksReembedded: number;
    model: string;
    dimensions: number;
  }> {
    const chunks = await this.curriculumService.getChunks(curriculumId);
    if (chunks.length === 0) {
      return { curriculumId, chunksReembedded: 0, model: 'none', dimensions: 0 };
    }

    const results = await this.gateway.embedBatch(
      chunks.map((c) => c.content),
    );

    for (let i = 0; i < chunks.length; i++) {
      await this.curriculumService.updateChunkEmbedding(
        chunks[i].id,
        `[${results[i].embedding.join(',')}]`,
        { ...(chunks[i].metadata || {}), embeddingModel: results[i].model },
      );
    }

    this.logger.log(
      `Re-embedded ${chunks.length} chunk(s) of curriculum ${curriculumId} with ${results[0].model} (${results[0].dimensions} dims)`,
    );

    return {
      curriculumId,
      chunksReembedded: chunks.length,
      model: results[0].model,
      dimensions: results[0].dimensions,
    };
  }

  /**
   * Retrieve relevant chunks for a query WITHOUT generating an answer.
   * Exposed separately so the UI can preview "what the model will see".
   */
  async retrieve(query: string, options: RagQueryOptions = {}) {
    const topK = options.topK ?? 5;
    const minSimilarity = options.minSimilarity ?? 0.25;

    const { embedding } = await this.gateway.embed(query);
    const rows = await this.curriculumService.searchByEmbedding(
      embedding,
      options.curriculumId,
      topK,
    );

    const sources = rows
      .filter((r) => r.distance < 1 - minSimilarity)
      .map((r) => ({
        chunkId: r.id,
        content: r.content,
        chunkIndex: r.chunkIndex,
        similarity: Number((1 - r.distance).toFixed(4)),
        curriculumId: r.curriculum?.id,
      }));

    return sources;
  }

  /**
   * Full RAG: retrieve + generate a grounded answer.
   *
   * `systemContext` is optional free-form context (e.g. a serialized student
   * profile) that is injected into the system prompt so the answer is
   * tailored without RAG leaking into the student module.
   */
  async ask(
    query: string,
    options: RagQueryOptions & { systemContext?: string; maxTokens?: number } = {},
  ): Promise<RagResult> {
    const topK = options.topK ?? 5;
    const minSimilarity = options.minSimilarity ?? 0.25;

    // 1. Retrieve
    const { embedding } = await this.gateway.embed(query);
    const rows = await this.curriculumService.searchByEmbedding(
      embedding,
      options.curriculumId,
      topK,
    );

    const relevant = rows
      .filter((r) => r.distance < 1 - minSimilarity)
      .map((r) => ({
        chunkId: r.id,
        content: r.content,
        chunkIndex: r.chunkIndex,
        similarity: Number((1 - r.distance).toFixed(4)),
        curriculumId: r.curriculum?.id,
      }));

    // 2. Edge case: nothing relevant retrieved
    if (relevant.length === 0) {
      const noContextResult = await this.gateway.chat(
        [
          {
            role: 'system',
            content:
              'You are a curriculum assistant. You have NO relevant curriculum context ' +
              'for this question. Answer honestly that no relevant curriculum content was ' +
              'found, and offer a general best-practice suggestion clearly labeled as such.',
          },
          { role: 'user', content: query },
        ],
        { maxTokens: options.maxTokens },
      );
      return {
        answer: noContextResult.content,
        model: noContextResult.model,
        sources: [],
        usage: noContextResult.usage,
      };
    }

    // 3. Build grounded prompt
    const contextBlocks = relevant
      .map(
        (s, i) =>
          `[Source ${i + 1}] (similarity ${s.similarity})\n${s.content}`,
      )
      .join('\n\n---\n\n');

    const systemPrompt = [
      'You are an expert curriculum planning assistant for K-12 teachers.',
      'Use ONLY the curriculum context below to ground your answer. Cite sources as [1], [2], etc.',
      'If the context is insufficient, say so and clearly label any general advice as a best-practice suggestion.',
      options.systemContext
        ? `Student context to keep in mind:\n${options.systemContext}`
        : '',
      'Curriculum context:\n\n' + contextBlocks,
    ]
      .filter(Boolean)
      .join('\n\n');

    // 4. Generate
    const result = await this.gateway.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      { maxTokens: options.maxTokens },
    );

    this.logger.log(
      `RAG query answered with ${relevant.length} source(s) via ${result.model}`,
    );

    // 5. Return with sources (resolve curriculum titles for display)
    const curriculumIds = [...new Set(relevant.map((s) => s.curriculumId))].filter(
      Boolean,
    ) as string[];
    const titleMap: Record<string, string> = {};
    for (const id of curriculumIds) {
      try {
        const c = await this.curriculumService.findOne(id);
        titleMap[id] = c.title;
      } catch {
        titleMap[id] = id;
      }
    }

    return {
      answer: result.content,
      model: result.model,
      sources: relevant.map((s) => ({
        ...s,
        curriculumTitle: titleMap[s.curriculumId] || s.curriculumId,
      })),
      usage: result.usage,
    };
  }

  /** Convenience: throw a friendly 400 if the caller passes nothing. */
  static validateQuery(query: string): void {
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new BadRequestException('query must be a non-empty string');
    }
  }
}
