import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Suggestion } from './suggestion.entity';

export interface CreateSuggestionDto {
  type: 'lesson_plan' | 'activity' | 'assessment' | 'intervention' | 'resource';
  content: string;
  title?: string;
  details?: Record<string, unknown>;
  modelUsed?: string;
  studentId: string;
  curriculumId?: string;
  ownerId?: string;
}

export interface UpdateSuggestionDto {
  type?: string;
  content?: string;
  title?: string;
  details?: Record<string, unknown>;
  status?: 'pending' | 'accepted' | 'modified' | 'rejected' | 'archived';
  modelUsed?: string;
}

@Injectable()
export class SuggestionService {
  constructor(
    @InjectRepository(Suggestion)
    private suggestionRepo: Repository<Suggestion>,
  ) {}

  async create(dto: CreateSuggestionDto): Promise<Suggestion> {
    const suggestion = this.suggestionRepo.create({
      ...dto,
      student: { id: dto.studentId } as any,
      curriculum: dto.curriculumId
        ? ({ id: dto.curriculumId } as any)
        : undefined,
    });
    return this.suggestionRepo.save(suggestion);
  }

  async findAll(
    studentId?: string,
    curriculumId?: string,
    status?: string,
  ): Promise<Suggestion[]> {
    const where: any = {};
    if (studentId) where.student = { id: studentId };
    if (curriculumId) where.curriculum = { id: curriculumId };
    if (status) where.status = status;
    return this.suggestionRepo.find({
      where,
      relations: { student: true, curriculum: true, feedback: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Chunk 12: create a placeholder row for a background generation job that
   * has been started but not yet completed. The generator fills in the content
   * and flips status to 'pending' when the LLM finishes.
   */
  async createPendingJob(params: {
    studentId: string;
    curriculumId?: string;
    ownerId?: string;
    focus?: string;
    kind?: string;
    details?: Record<string, unknown>;
  }): Promise<Suggestion> {
    const job = this.suggestionRepo.create({
      type: 'resource' as const,
      content: '',
      title: 'Generating…',
      status: 'generating',
      details: {
        generationId: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jobType: 'resource_generation',
        kind: params.kind,
        focus: params.focus,
        ...(params.details ?? {}),
      },
      student: { id: params.studentId } as any,
      curriculum: params.curriculumId
        ? ({ id: params.curriculumId } as any)
        : undefined,
      ownerId: params.ownerId,
    });
    return this.suggestionRepo.save(job);
  }

  /** Chunk 12: resolve a background generation job (success or failure). */
  async resolveJob(
    id: string,
    result: {
      type: string;
      title: string;
      content: string;
      summary?: string;
      modelUsed?: string;
      sources?: Array<{ chunkId: string; similarity: number }>;
      status?: 'pending' | 'failed';
      error?: string;
    },
  ): Promise<Suggestion> {
    const existing = await this.findOne(id);
    existing.type = result.type as Suggestion['type'];
    existing.title = result.title;
    existing.content = result.content;
    existing.status = result.status === 'failed' ? 'failed' : 'pending';
    existing.modelUsed = result.modelUsed;
    const details = (existing.details as Record<string, unknown>) || {};
    if (result.summary) details.summary = result.summary;
    if (result.sources) details.sources = result.sources;
    if (result.error) details.error = result.error;
    existing.details = details;
    return this.suggestionRepo.save(existing);
  }

  async findOne(id: string): Promise<Suggestion> {
    const suggestion = await this.suggestionRepo.findOne({
      where: { id },
      relations: { student: true, curriculum: true, feedback: true },
    });
    if (!suggestion) {
      throw new NotFoundException(`Suggestion ${id} not found`);
    }
    return suggestion;
  }

  async update(id: string, dto: UpdateSuggestionDto): Promise<Suggestion> {
    const suggestion = await this.findOne(id);
    Object.assign(suggestion, dto);
    return this.suggestionRepo.save(suggestion);
  }

  async remove(id: string): Promise<void> {
    const suggestion = await this.findOne(id);
    await this.suggestionRepo.remove(suggestion);
  }

  // Update status (used when teacher accepts/modifies/rejects)
  async updateStatus(
    id: string,
    status: 'accepted' | 'modified' | 'rejected' | 'archived',
  ): Promise<Suggestion> {
    const suggestion = await this.findOne(id);
    suggestion.status = status;
    return this.suggestionRepo.save(suggestion);
  }
}
