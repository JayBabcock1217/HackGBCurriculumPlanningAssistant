import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Curriculum } from './curriculum.entity';
import { CurriculumChunk } from './curriculum-chunk.entity';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Curriculum, CurriculumChunk])],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
