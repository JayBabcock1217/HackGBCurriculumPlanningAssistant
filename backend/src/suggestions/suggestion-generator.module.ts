import { Module } from '@nestjs/common';
import { StudentModule } from '../database/student/student.module';
import { CurriculumModule } from '../database/curriculum/curriculum.module';
import { SuggestionModule } from '../database/suggestion/suggestion.module';
import { FeedbackModule } from '../database/feedback/feedback.module';
import { RagModule } from '../rag/rag.module';
import { LlmGatewayModule } from '../llm-gateway/llm-gateway.module';
import { SuggestionGeneratorService } from './suggestion-generator.service';
import { SuggestionGeneratorController } from './suggestion-generator.controller';

@Module({
  imports: [StudentModule, CurriculumModule, SuggestionModule, FeedbackModule, RagModule, LlmGatewayModule],
  controllers: [SuggestionGeneratorController],
  providers: [SuggestionGeneratorService],
  exports: [SuggestionGeneratorService],
})
export class SuggestionGeneratorModule {}
