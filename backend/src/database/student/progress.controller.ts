import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import {
  ProgressService,
  StudentTimeline,
  ClassTimeline,
} from './progress.service';

/**
 * ProgressController (Chunk 9)
 *
 * Read-only aggregation endpoints for the progress dashboards.
 *   GET /api/progress/students/:studentId   -> per-student timeline
 *   GET /api/progress/class?teacherId=...   -> per-class timeline
 */
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('students/:studentId')
  async studentTimeline(@Param('studentId') studentId: string): Promise<StudentTimeline> {
    return this.progressService.studentTimeline(studentId);
  }

  @Get('class')
  async classTimeline(@Query('teacherId') teacherId: string): Promise<ClassTimeline> {
    // teacherId identifies the class; without it the request is malformed.
    if (!teacherId) {
      throw new BadRequestException('teacherId query parameter is required');
    }
    return this.progressService.classTimeline(teacherId);
  }
}
