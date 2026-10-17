import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { TeacherService, CreateTeacherDto, UpdateTeacherDto } from './teacher.service';
import { Teacher } from './teacher.entity';

@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post()
  async create(@Body() dto: CreateTeacherDto): Promise<Teacher> {
    return this.teacherService.create(dto);
  }

  @Get()
  async findAll(): Promise<Teacher[]> {
    return this.teacherService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Teacher> {
    return this.teacherService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ): Promise<Teacher> {
    return this.teacherService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.teacherService.remove(id);
  }
}
