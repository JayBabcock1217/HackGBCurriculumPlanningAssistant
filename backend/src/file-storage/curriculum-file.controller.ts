import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { Response } from 'express';
import { CurriculumProcessingService, ProcessCurriculumResult } from './curriculum-processing.service';
import { FileStorageService } from './file-storage.service';
import { CurriculumService } from '../database/curriculum/curriculum.service';

@Controller('curricula')
export class CurriculumFileController {
  constructor(
    private readonly processingService: CurriculumProcessingService,
    private readonly fileStorage: FileStorageService,
    private readonly curriculumService: CurriculumService,
  ) {}

  /**
   * POST /api/curricula/upload
   * Upload and process a curriculum file.
   * Accepts multipart/form-data with:
   *   - file: the document (PDF or DOCX)
   *   - title: curriculum title
   *   - teacherId: owning teacher
   *   - subject, gradeLevel, description: optional metadata
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('teacherId') teacherId: string,
    @Body('subject') subject?: string,
    @Body('gradeLevel') gradeLevel?: string,
    @Body('description') description?: string,
  ): Promise<ProcessCurriculumResult> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'word';

    return this.processingService.processCurriculum({
      teacherId,
      title: title || file.originalname,
      subject,
      gradeLevel,
      description,
      fileName: file.originalname,
      fileType,
      fileBuffer: file.buffer,
    });
  }

  /**
   * POST /api/curricula/search
   * Search curriculum content using vector similarity
   */
  @Post('search')
  async search(
    @Body() body: { query: string; curriculumId?: string; limit?: number },
  ) {
    return this.processingService.searchCurriculum(
      body.query,
      body.curriculumId,
      body.limit,
    );
  }

  /**
   * GET /api/curricula/:id/file
   * Download the original file
   */
  @Get(':id/file')
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const curriculum = await this.curriculumService.findOne(id);
    if (!curriculum.fileUrl) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const buffer = await this.fileStorage.downloadFile(curriculum.fileUrl);
    const contentType =
      curriculum.fileType === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${curriculum.fileName}"`,
    );
    res.send(buffer);
  }

  /**
   * DELETE /api/curricula/:id/file
   * Delete a curriculum's stored file and its database record.
   * (Uses /file suffix to avoid shadowing CurriculumController's DELETE :id)
   */
  @Delete(':id/file')
  async delete(@Param('id') id: string): Promise<void> {
    await this.processingService.deleteCurriculum(id);
  }
}
