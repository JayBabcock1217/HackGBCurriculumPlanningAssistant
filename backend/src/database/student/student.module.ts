import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './student.entity';
import { ProgressEntry } from './progress-entry.entity';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Student, ProgressEntry])],
  controllers: [StudentController, ProgressController],
  providers: [StudentService, ProgressService],
  exports: [StudentService, ProgressService],
})
export class StudentModule {}
