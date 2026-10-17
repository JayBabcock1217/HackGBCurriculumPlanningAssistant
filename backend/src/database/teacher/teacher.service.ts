import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from './teacher.entity';

export interface CreateTeacherDto {
  email: string;
  firstName: string;
  lastName: string;
  schoolName?: string;
  gradeLevel?: string;
  subject?: string;
  language?: string;
  role?: string;
}

export interface UpdateTeacherDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  schoolName?: string;
  gradeLevel?: string;
  subject?: string;
  language?: string;
  role?: string;
}

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
  ) {}

  async create(dto: CreateTeacherDto): Promise<Teacher> {
    const teacher = this.teacherRepo.create(dto);
    return this.teacherRepo.save(teacher);
  }

  async findAll(): Promise<Teacher[]> {
    return this.teacherRepo.find();
  }

  async findOne(id: string): Promise<Teacher> {
    const teacher = await this.teacherRepo.findOne({ where: { id } });
    if (!teacher) {
      throw new NotFoundException(`Teacher ${id} not found`);
    }
    return teacher;
  }

  async findByEmail(email: string): Promise<Teacher | null> {
    return this.teacherRepo.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.findOne(id);
    Object.assign(teacher, dto);
    return this.teacherRepo.save(teacher);
  }

  async remove(id: string): Promise<void> {
    const teacher = await this.findOne(id);
    await this.teacherRepo.remove(teacher);
  }
}
