import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './feedback.entity';

export interface CreateFeedbackDto {
  action: 'accepted' | 'modified' | 'rejected';
  reason?: string;
  teacherComment?: string;
  modifiedContent?: string;
  suggestionId: string;
  teacherId: string;
  embedding?: string;
}

export interface UpdateFeedbackDto {
  action?: 'accepted' | 'modified' | 'rejected';
  reason?: string;
  teacherComment?: string;
  modifiedContent?: string;
  embedding?: string;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private feedbackRepo: Repository<Feedback>,
  ) {}

  async create(dto: CreateFeedbackDto): Promise<Feedback> {
    const feedback = this.feedbackRepo.create({
      ...dto,
      suggestion: { id: dto.suggestionId } as any,
      teacher: { id: dto.teacherId } as any,
    });
    return this.feedbackRepo.save(feedback);
  }

  async findAll(teacherId?: string): Promise<Feedback[]> {
    const where: any = {};
    if (teacherId) {
      where.teacher = { id: teacherId };
    }
    return this.feedbackRepo.find({
      where,
      relations: { suggestion: true, teacher: true },
    });
  }

  async findOne(id: string): Promise<Feedback> {
    const feedback = await this.feedbackRepo.findOne({
      where: { id },
      relations: { suggestion: true, teacher: true },
    });
    if (!feedback) {
      throw new NotFoundException(`Feedback ${id} not found`);
    }
    return feedback;
  }

  async update(id: string, dto: UpdateFeedbackDto): Promise<Feedback> {
    const feedback = await this.findOne(id);
    Object.assign(feedback, dto);
    return this.feedbackRepo.save(feedback);
  }

  async remove(id: string): Promise<void> {
    const feedback = await this.findOne(id);
    await this.feedbackRepo.remove(feedback);
  }

  // Find feedback for a specific suggestion
  async findBySuggestion(suggestionId: string): Promise<Feedback | null> {
    return this.feedbackRepo.findOne({
      where: { suggestion: { id: suggestionId } },
    });
  }

  // Vector similarity search for relevant past feedback
  async searchByEmbedding(
    embedding: number[],
    teacherId: string,
    limit: number = 5,
  ): Promise<(Feedback & { similarity: number })[]> {
    const embeddingStr = `[${embedding.join(',')}]`;
    const query = `
      SELECT f.*, 1 - (f.embedding <=> $1::vector) AS similarity
      FROM feedback f
      WHERE f.teacher_id = $2 AND f.embedding IS NOT NULL
      ORDER BY f.embedding <=> $1::vector
      LIMIT $3
    `;
    const result = await this.feedbackRepo.query(query, [
      embeddingStr,
      teacherId,
      limit,
    ]);
    return result.map((row: any) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      teacherComment: row.teacher_comment,
      modifiedContent: row.modified_content,
      embedding: row.embedding,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suggestion: { id: row.suggestion_id },
      teacher: { id: row.teacher_id },
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Chunk 8: retrieve the teacher's most relevant past feedback for a new
   * generation, ranked by a blend of semantic similarity and recency.
   *
   *   weight = 0.7 * similarity + 0.3 * recency
   *
   * where recency = exp(-age_days / halfLifeDays). Newer feedback matters more
   * (a teacher's current preferences should outweigh stale ones). Feedback
   * without an embedding still participates via recency alone (similarity 0),
   * so a first-time teacher with only unembedded feedback still gets guidance.
   *
   * Returns at most `limit` entries, best-weighted first, each annotated with
   * its similarity, recency, and combined weight.
   */
  async findRelevant(
    teacherId: string,
    queryEmbedding: number[],
    options: { limit?: number; halfLifeDays?: number } = {},
  ): Promise<
    Array<
      Feedback & {
        similarity: number;
        recency: number;
        weight: number;
      }
    >
  > {
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
    const halfLifeDays = options.halfLifeDays ?? 30;

    // 1. Similarity pass (only feedback that has an embedding).
    const similar = await this.searchByEmbedding(
      queryEmbedding,
      teacherId,
      Math.max(limit * 2, 20),
    );

    // 2. Recency pass (all feedback, newest first).
    const recent = await this.feedbackRepo.find({
      where: { teacher: { id: teacherId } },
      order: { createdAt: 'DESC' },
      take: Math.max(limit * 2, 20),
    });

    const now = Date.now();
    const scored: Array<{
      fb: Feedback;
      similarity: number;
      recency: number;
      weight: number;
    }> = [];
    const seen = new Set<string>();

    for (const row of similar) {
      const ageDays = (now - new Date(row.createdAt).getTime()) / 86_400_000;
      const recency = Math.exp(-Math.max(ageDays, 0) / halfLifeDays);
      scored.push({
        fb: row,
        similarity: row.similarity,
        recency,
        weight: 0.7 * row.similarity + 0.3 * recency,
      });
      seen.add(row.id);
    }

    // Recency-only entries (no embedding) so unembedded feedback still counts.
    for (const fb of recent) {
      if (seen.has(fb.id)) continue;
      const ageDays = (now - new Date(fb.createdAt).getTime()) / 86_400_000;
      const recency = Math.exp(-Math.max(ageDays, 0) / halfLifeDays);
      scored.push({ fb, similarity: 0, recency, weight: 0.3 * recency });
    }

    scored.sort((a, b) => b.weight - a.weight);
    return scored.slice(0, limit).map((s) => ({
      ...s.fb,
      similarity: s.similarity,
      recency: s.recency,
      weight: s.weight,
    }));
  }
}
