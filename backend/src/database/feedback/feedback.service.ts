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
}
