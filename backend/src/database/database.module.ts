import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from './curriculum/curriculum.module';
import { StudentModule } from './student/student.module';
import { FeedbackModule } from './feedback/feedback.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { TeacherModule } from './teacher/teacher.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
    }),
    TeacherModule,
    CurriculumModule,
    StudentModule,
    FeedbackModule,
    SuggestionModule,
  ],
})
export class DatabaseModule {}
