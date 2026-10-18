import { Module } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmGatewayService } from './llm-gateway.service';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { loadLlmGatewayConfig } from './llm-gateway.config';
import { LLM_GATEWAY_CONFIG, LLM_ADAPTERS } from './llm-gateway.tokens';

@Module({
  controllers: [LlmController],
  providers: [
    LlmGatewayService,
    OllamaAdapter,
    OpenAiAdapter,
    AnthropicAdapter,
    { provide: LLM_GATEWAY_CONFIG, useFactory: () => loadLlmGatewayConfig() },
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
