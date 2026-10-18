import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  StudentService,
  CreateStudentDto,
  UpdateStudentDto,
  CreateProgressEntryDto,
} from './student.service';
import { Student } from './student.entity';
import { ProgressEntry } from './progress-entry.entity';

@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  async create(@Body() dto: CreateStudentDto): Promise<Student> {
    return this.studentService.create(dto);
  }

  @Get()
  async findAll(@Query('teacherId') teacherId?: string): Promise<Student[]> {
    return this.studentService.findAll(teacherId);
  }

  // Query endpoints (Chunk 6) — must be declared before ':id' so the
  // literal segments win route resolution.
  @Get('query/reading-level')
  async queryByReadingLevel(
    @Query('teacherId') teacherId: string,
    @Query('minLevel') minLevel?: string,
    @Query('maxLevel') maxLevel?: string,
  ): Promise<Student[]> {
    if (!teacherId) {
      return [];
    }
    return this.studentService.findByReadingLevel(
      teacherId,
      minLevel != null && minLevel !== '' ? Number(minLevel) : undefined,
      maxLevel != null && maxLevel !== '' ? Number(maxLevel) : undefined,
    );
  }

  @Get('query/skill')
  async queryBySkill(
    @Query('teacherId') teacherId: string,
    @Query('skill') skill: string,
  ): Promise<Student[]> {
    if (!teacherId || !skill) {
      return [];
    }
    return this.studentService.findBySkill(teacherId, skill);
  }

  @Get('query/learning-difference')
  async queryByLearningDifference(
    @Query('teacherId') teacherId: string,
    @Query('type') type: string,
  ): Promise<Student[]> {
    if (!teacherId || !type) {
      return [];
    }
    return this.studentService.findByLearningDifference(teacherId, type);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Student> {
    return this.studentService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<Student> {
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.studentService.remove(id);
  }

  // Progress entries
  @Post(':id/progress')
  async addProgress(
    @Param('id') id: string,
    @Body() dto: CreateProgressEntryDto,
  ): Promise<ProgressEntry> {
    return this.studentService.addProgressEntry(id, dto);
  }

  @Get(':id/progress')
  async getProgress(
    @Param('id') id: string,
    @Query('skillArea') skillArea?: string,
  ): Promise<ProgressEntry[]> {
    return this.studentService.getProgressEntries(id, skillArea);
  }
}
