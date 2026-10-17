import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurriculumService, CreateCurriculumDto, UpdateCurriculumDto } from './curriculum.service';
import { Curriculum } from './curriculum.entity';
import { CurriculumChunk } from './curriculum-chunk.entity';

@Controller('curricula')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Post()
  async create(@Body() dto: CreateCurriculumDto): Promise<Curriculum> {
    return this.curriculumService.create(dto);
  }

  @Get()
  async findAll(@Query('teacherId') teacherId?: string): Promise<Curriculum[]> {
    return this.curriculumService.findAll(teacherId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Curriculum> {
    return this.curriculumService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCurriculumDto,
  ): Promise<Curriculum> {
    return this.curriculumService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.curriculumService.remove(id);
  }

  @Get(':id/chunks')
  async getChunks(@Param('id') id: string): Promise<CurriculumChunk[]> {
    return this.curriculumService.getChunks(id);
  }

  @Post(':id/search')
  async search(
    @Param('id') id: string,
    @Body() body: { embedding: number[]; limit?: number },
  ) {
    return this.curriculumService.searchByEmbedding(
      body.embedding,
      id,
      body.limit,
    );
  }
}
