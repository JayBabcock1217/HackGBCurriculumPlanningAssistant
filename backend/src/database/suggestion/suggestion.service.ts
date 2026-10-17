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
