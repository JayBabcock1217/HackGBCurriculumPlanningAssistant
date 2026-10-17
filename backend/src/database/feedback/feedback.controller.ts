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
  FeedbackService,
  CreateFeedbackDto,
  UpdateFeedbackDto,
} from './feedback.service';
import { Feedback } from './feedback.entity';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Body() dto: CreateFeedbackDto): Promise<Feedback> {
    return this.feedbackService.create(dto);
  }

  @Get()
  async findAll(@Query('teacherId') teacherId?: string): Promise<Feedback[]> {
    return this.feedbackService.findAll(teacherId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Feedback> {
    return this.feedbackService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ): Promise<Feedback> {
    return this.feedbackService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.feedbackService.remove(id);
  }

  @Get('suggestion/:suggestionId')
  async findBySuggestion(
    @Param('suggestionId') suggestionId: string,
  ): Promise<Feedback | null> {
    return this.feedbackService.findBySuggestion(suggestionId);
  }

  @Post('search')
  async search(
    @Body() body: { embedding: number[]; teacherId: string; limit?: number },
  ) {
    return this.feedbackService.searchByEmbedding(
      body.embedding,
      body.teacherId,
      body.limit,
    );
  }
}
