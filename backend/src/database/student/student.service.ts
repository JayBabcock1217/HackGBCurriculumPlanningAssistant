import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Student } from './student.entity';
import { ProgressEntry } from './progress-entry.entity';

export interface CreateStudentDto {
  firstName: string;
  lastName: string;
  gradeLevel?: string;
  readingLevel?: number;
  mathAbility?: number;
  skills?: string[];
  iepDetails?: any;
  ellStatus?: any;
  learningDifferences?: any[];
  socialEmotionalNotes?: string;
  teacherNotes?: string;
  teacherId: string;
}

export interface UpdateStudentDto {
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
  readingLevel?: number;
  mathAbility?: number;
  skills?: string[];
  iepDetails?: any;
  ellStatus?: any;
  learningDifferences?: any[];
  socialEmotionalNotes?: string;
  teacherNotes?: string;
}

export interface CreateProgressEntryDto {
  skillArea: string;
  skillName: string;
  score: number;
  maxScore?: number;
  notes?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(ProgressEntry)
    private progressRepo: Repository<ProgressEntry>,
  ) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    const student = this.studentRepo.create({
      ...dto,
      teacher: { id: dto.teacherId } as any,
    });
    return this.studentRepo.save(student);
  }

  async findAll(teacherId?: string): Promise<Student[]> {
    const where: any = {};
    if (teacherId) {
      where.teacher = { id: teacherId };
    }
    return this.studentRepo.find({
      where,
      relations: { progressEntries: true },
    });
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: { progressEntries: true },
    });
    if (!student) {
      throw new NotFoundException(`Student ${id} not found`);
    }
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    Object.assign(student, dto);
    return this.studentRepo.save(student);
  }

  async remove(id: string): Promise<void> {
    const student = await this.findOne(id);
    await this.studentRepo.remove(student);
  }

  // Progress entries
  async addProgressEntry(
    studentId: string,
    dto: CreateProgressEntryDto,
  ): Promise<ProgressEntry> {
    const student = await this.findOne(studentId);
    const entry = this.progressRepo.create({
      ...dto,
      student,
    });
    return this.progressRepo.save(entry);
  }

  async getProgressEntries(
    studentId: string,
    skillArea?: string,
  ): Promise<ProgressEntry[]> {
    const where: any = { student: { id: studentId } };
    if (skillArea) {
      where.skillArea = skillArea;
    }
    return this.progressRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  // Search and filter (Chunk 6: query by reading level, by skill, by
  // learning difference — always scoped to a teacher)
  async findByReadingLevel(
    teacherId: string,
    minLevel?: number,
    maxLevel?: number,
  ): Promise<Student[]> {
    // Build a query-builder so min/max bounds can be combined (a FindOptions
    // `where` cannot express a range on one column with two operators).
    const qb = this.studentRepo
      .createQueryBuilder('student')
      .where('student.teacher.id = :teacherId', { teacherId });
    if (minLevel != null) {
      qb.andWhere('student.readingLevel >= :minLevel', { minLevel });
    }
    if (maxLevel != null) {
      qb.andWhere('student.readingLevel <= :maxLevel', { maxLevel });
    }
    return qb.getMany();
  }

  /**
   * Students whose `skills` array contains the given skill. Uses a JSONB
   * containment match on the normalized array, which is exact and avoids
   * partial string matches ("ad" would not match "addition").
   */
  async findBySkill(teacherId: string, skill: string): Promise<Student[]> {
    return this.studentRepo
      .createQueryBuilder('student')
      .where('student.teacher.id = :teacherId', { teacherId })
      .andWhere('student.skills @> :skill', {
        skill: JSON.stringify([skill]),
      })
      .getMany();
  }

  async findByLearningDifference(
    teacherId: string,
    differenceType: string,
  ): Promise<Student[]> {
    return this.studentRepo
      .createQueryBuilder('student')
      .where('student.teacher.id = :teacherId', { teacherId })
      .andWhere(
        `student.learningDifferences @> :diff`,
        { diff: JSON.stringify([{ type: differenceType }]) },
      )
      .getMany();
  }
}
