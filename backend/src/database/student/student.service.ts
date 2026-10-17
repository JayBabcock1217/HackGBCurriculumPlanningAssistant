import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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

  // Search and filter
  async findByReadingLevel(
    teacherId: string,
    minLevel: number,
    maxLevel?: number,
  ): Promise<Student[]> {
    const where: any = { teacher: { id: teacherId } };
    where.readingLevel = minLevel;
    if (maxLevel) {
      where.readingLevel = LessThanOrEqual(maxLevel);
    }
    return this.studentRepo.find({ where });
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
