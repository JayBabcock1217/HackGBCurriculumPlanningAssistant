import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { DocumentParserService } from './document-parser.service';
import { TextChunkingService, TextChunk } from './text-chunking.service';
import { EmbeddingService } from './embedding.service';
import { CurriculumService } from '../database/curriculum/curriculum.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

export interface ProcessCurriculumResult {
  curriculumId: string;
  totalChunks: number;
  totalCharacters: number;
  totalPages?: number;
  processingTimeMs: number;
}

@Injectable()
export class CurriculumProcessingService {
  private readonly logger = new Logger(CurriculumProcessingService.name);

  constructor(
    private readonly fileStorage: FileStorageService,
    private readonly parser: DocumentParserService,
    private readonly chunker: TextChunkingService,
    private readonly embedder: EmbeddingService,
    private readonly curriculumService: CurriculumService,
    // Chunk 5: real embeddings via the LLM gateway (replaces pseudo-embeddings
    // so uploads are immediately RAG-searchable with the same model as queries).
    private readonly gateway: LlmGatewayService,
  ) {}

  /**
   * Full pipeline: upload file → parse → chunk → embed → store
   */
  async processCurriculum(options: {
    teacherId: string;
    title: string;
    subject?: string;
    gradeLevel?: string;
    description?: string;
    fileName: string;
    fileType: 'pdf' | 'word' | 'text';
    fileBuffer: Buffer;
    metadata?: Record<string, unknown>;
  }): Promise<ProcessCurriculumResult> {
    const startTime = Date.now();
    const {
      teacherId,
      title,
      subject,
      gradeLevel,
      description,
      fileName,
      fileType,
      fileBuffer,
      metadata,
    } = options;

    // 1. Upload file to storage
    const storageKey = `curricula/${teacherId}/${Date.now()}-${fileName}`;
    const contentType =
      fileType === 'pdf'
        ? 'application/pdf'
        : fileType === 'word'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'text/plain';

    await this.fileStorage.uploadFile(storageKey, fileBuffer, contentType);
    this.logger.log(`Step 1: File uploaded to ${storageKey}`);

    // 2. Parse the document
    const parsed = await this.parser.parse(fileBuffer, fileType);
    this.logger.log(
      `Step 2: Parsed ${parsed.text.length} characters${parsed.pages ? `, ${parsed.pages} pages` : ''}`,
    );

    // 3. Create curriculum record
    const curriculum = await this.curriculumService.create({
      title,
      subject,
      gradeLevel,
      description,
      fileType,
      fileName,
      fileUrl: storageKey,
      metadata: {
        ...metadata,
        ...parsed.metadata,
        totalCharacters: parsed.text.length,
        totalPages: parsed.pages,
      },
      teacherId,
    });
    this.logger.log(`Step 3: Curriculum created: ${curriculum.id}`);

    // 4. Chunk the text
    const chunks = this.chunker.chunkText(parsed.text);
    this.logger.log(`Step 4: Text chunked into ${chunks.length} chunks`);

    // 5. Generate embeddings for each chunk via the LLM gateway (real model).
    //    This keeps new uploads dimension-consistent with RAG queries.
    this.logger.log('Step 5: Generating embeddings via LLM gateway...');
    const embeddingResults = await this.gateway.embedBatch(
      chunks.map((c) => c.content),
    );

    // 6. Store chunks with embeddings
    const chunkData = chunks.map((chunk, i) => ({
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      embedding: `[${embeddingResults[i].embedding.join(',')}]`,
      metadata: {
        ...chunk.metadata,
        embeddingModel: embeddingResults[i].model,
      },
    }));

    await this.curriculumService.addChunks(curriculum.id, chunkData);
    this.logger.log(`Step 6: Stored ${chunkData.length} chunks with embeddings`);

    const processingTimeMs = Date.now() - startTime;
    this.logger.log(
      `Pipeline complete in ${processingTimeMs}ms: ${chunks.length} chunks from ${parsed.text.length} chars`,
    );

    return {
      curriculumId: curriculum.id,
      totalChunks: chunks.length,
      totalCharacters: parsed.text.length,
      totalPages: parsed.pages,
      processingTimeMs,
    };
  }

  /**
   * Search curriculum content using vector similarity
   */
  async searchCurriculum(
    query: string,
    curriculumId?: string,
    limit: number = 10,
  ) {
    // Embed the query via the LLM gateway (real model) so it matches the
    // dimension of the stored chunk embeddings.
    const { embedding } = await this.gateway.embed(query);

    // Search using vector similarity
    return this.curriculumService.searchByEmbedding(
      embedding,
      curriculumId,
      limit,
    );
  }

  /**
   * Delete a curriculum and its associated file
   */
  async deleteCurriculum(curriculumId: string): Promise<void> {
    const curriculum = await this.curriculumService.findOne(curriculumId);
    if (curriculum.fileUrl) {
      await this.fileStorage.deleteFile(curriculum.fileUrl);
    }
    await this.curriculumService.remove(curriculumId);
  }
}
