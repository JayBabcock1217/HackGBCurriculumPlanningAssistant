import { Module } from '@nestjs/common';
import { CurriculumModule } from '../database/curriculum/curriculum.module';
import { FileStorageService } from './file-storage.service';
import { DocumentParserService } from './document-parser.service';
import { TextChunkingService } from './text-chunking.service';
import { EmbeddingService } from './embedding.service';
import { CurriculumProcessingService } from './curriculum-processing.service';
import { CurriculumFileController } from './curriculum-file.controller';

@Module({
  imports: [CurriculumModule],
  controllers: [CurriculumFileController],
  providers: [
    FileStorageService,
    DocumentParserService,
    TextChunkingService,
    EmbeddingService,
    CurriculumProcessingService,
  ],
  exports: [CurriculumProcessingService, FileStorageService],
})
export class FileStorageModule {}
