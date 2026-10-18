import { Module } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmGatewayService } from './llm-gateway.service';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { LlmGatewayState } from './llm-gateway.state';
import { LLM_ADAPTERS } from './llm-gateway.tokens';

@Module({
  controllers: [LlmController],
  providers: [
    LlmGatewayState,
    LlmGatewayService,
    OllamaAdapter,
    OpenAiAdapter,
    AnthropicAdapter,
    {
      provide: LLM_ADAPTERS,
      useFactory: (
        ollama: OllamaAdapter,
        openai: OpenAiAdapter,
        anthropic: AnthropicAdapter,
      ) => ({ ollama, openai, anthropic }),
      inject: [OllamaAdapter, OpenAiAdapter, AnthropicAdapter],
    },
  ],
  exports: [LlmGatewayService],
})
export class LlmGatewayModule {}
