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
  SuggestionService,
  CreateSuggestionDto,
  UpdateSuggestionDto,
} from './suggestion.service';
import { Suggestion } from './suggestion.entity';

@Controller('suggestions')
export class SuggestionController {
  constructor(private readonly suggestionService: SuggestionService) {}

  @Post()
  async create(@Body() dto: CreateSuggestionDto): Promise<Suggestion> {
    return this.suggestionService.create(dto);
  }

  @Get()
  async findAll(
    @Query('studentId') studentId?: string,
    @Query('curriculumId') curriculumId?: string,
    @Query('status') status?: string,
  ): Promise<Suggestion[]> {
    return this.suggestionService.findAll(studentId, curriculumId, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Suggestion> {
    return this.suggestionService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestionDto,
  ): Promise<Suggestion> {
    return this.suggestionService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.suggestionService.remove(id);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'accepted' | 'modified' | 'rejected' | 'archived' },
  ): Promise<Suggestion> {
    return this.suggestionService.updateStatus(id, body.status);
  }
}
