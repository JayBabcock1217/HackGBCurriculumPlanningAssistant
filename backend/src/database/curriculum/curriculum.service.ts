import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Curriculum } from './curriculum.entity';
import { CurriculumChunk } from './curriculum-chunk.entity';

export interface CreateCurriculumDto {
  title: string;
  subject?: string;
  gradeLevel?: string;
  description?: string;
  fileType: 'pdf' | 'word' | 'google_docs' | 'text';
  fileName: string;
  fileUrl?: string;
  metadata?: Record<string, unknown>;
  teacherId: string;
}

export interface UpdateCurriculumDto {
  title?: string;
  subject?: string;
  gradeLevel?: string;
  description?: string;
  fileUrl?: string;
  chunkCount?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(Curriculum)
    private curriculumRepo: Repository<Curriculum>,
    @InjectRepository(CurriculumChunk)
    private chunkRepo: Repository<CurriculumChunk>,
  ) {}

  async create(dto: CreateCurriculumDto): Promise<Curriculum> {
    const curriculum = this.curriculumRepo.create({
      ...dto,
      teacher: { id: dto.teacherId } as any,
    });
    return this.curriculumRepo.save(curriculum);
  }

  async findAll(teacherId?: string): Promise<Curriculum[]> {
    const where: any = {};
    if (teacherId) {
      where.teacher = { id: teacherId };
    }
    return this.curriculumRepo.find({
      where,
      relations: { chunks: true },
    });
  }

  async findOne(id: string): Promise<Curriculum> {
    const curriculum = await this.curriculumRepo.findOne({
      where: { id },
      relations: { chunks: true },
    });
    if (!curriculum) {
      throw new NotFoundException(`Curriculum ${id} not found`);
    }
    return curriculum;
  }

  async update(id: string, dto: UpdateCurriculumDto): Promise<Curriculum> {
    const curriculum = await this.findOne(id);
    Object.assign(curriculum, dto);
    return this.curriculumRepo.save(curriculum);
  }

  async remove(id: string): Promise<void> {
    const curriculum = await this.findOne(id);
    await this.curriculumRepo.remove(curriculum);
  }

  // Chunk operations
  async addChunks(
    curriculumId: string,
    chunks: { content: string; chunkIndex: number; tokenCount: number; embedding?: string; metadata?: Record<string, unknown> }[],
  ): Promise<CurriculumChunk[]> {
    const curriculum = await this.curriculumRepo.findOne({
      where: { id: curriculumId },
    });
    if (!curriculum) {
      throw new Error(`Curriculum ${curriculumId} not found for addChunks`);
    }
    const chunkEntities = chunks.map((c) =>
      this.chunkRepo.create({
        ...c,
        curriculum,
      } as CurriculumChunk),
    );
    const saved = await this.chunkRepo.save(chunkEntities);

    // Update chunk count
    curriculum.chunkCount = saved.length;
    await this.curriculumRepo.save(curriculum);

    return saved;
  }

  async getChunks(curriculumId: string): Promise<CurriculumChunk[]> {
    return this.chunkRepo.find({
      where: { curriculum: { id: curriculumId } },
      order: { chunkIndex: 'ASC' },
    });
  }

  // Update a single chunk's embedding (used by RAG re-embedding migration)
  async updateChunkEmbedding(
    chunkId: string,
    embedding: string,
    metadata?: Record<string, unknown>,
  ): Promise<CurriculumChunk> {
    const chunk = await this.chunkRepo.findOne({ where: { id: chunkId } });
    if (!chunk) {
      throw new NotFoundException(`Chunk ${chunkId} not found`);
    }
    chunk.embedding = embedding;
    if (metadata) {
      chunk.metadata = { ...chunk.metadata, ...metadata };
    }
    return this.chunkRepo.save(chunk);
  }

  // Vector similarity search using pgvector
  async searchByEmbedding(
    embedding: number[],
    curriculumId?: string,
    limit: number = 10,
  ): Promise<(CurriculumChunk & { distance: number })[]> {
    const embeddingStr = `[${embedding.join(',')}]`;
    const params: any[] = [embeddingStr, limit];
    // The embedding column is stored as TEXT (serialized vector). The pgvector
    // distance operators only work on `vector`-typed operands, so we cast the
    // stored text column to ::vector for the comparison.
    // Note: TypeORM created the column names as camelCase quoted identifiers
    // (e.g. "curriculumId", "chunkIndex"), so the raw SQL must quote them.
    let query = `
      SELECT c.*, 1 - (c."embedding"::vector <=> $1::vector) AS similarity
      FROM "curriculum_chunks" c
    `;
    if (curriculumId) {
      query += ' WHERE c."curriculumId" = $2';
      params.splice(1, 0, curriculumId);
    }
    query +=
      ' ORDER BY c."embedding"::vector <=> $1::vector LIMIT $' +
      (curriculumId ? 3 : 2);

    const result = await this.chunkRepo.query(query, params);
    return result.map((row: any) => ({
      id: row.id,
      content: row.content,
      chunkIndex: row.chunkIndex,
      tokenCount: row.tokenCount,
      embedding: row.embedding,
      metadata: row.metadata,
      createdAt: row.createdAt,
      curriculum: { id: row.curriculumId },
      distance: 1 - parseFloat(row.similarity),
    }));
  }
}
