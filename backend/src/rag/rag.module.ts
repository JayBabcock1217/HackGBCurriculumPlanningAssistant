import { Module } from '@nestjs/common';
import { CurriculumModule } from '../database/curriculum/curriculum.module';
import { LlmGatewayModule } from '../llm-gateway/llm-gateway.module';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [CurriculumModule, LlmGatewayModule],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
