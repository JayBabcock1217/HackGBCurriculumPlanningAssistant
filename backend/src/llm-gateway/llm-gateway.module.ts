import { Module } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmGatewayService } from './llm-gateway.service';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { LmManagerAdapter } from './adapters/lm-manager.adapter';
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
    LmManagerAdapter,
    AnthropicAdapter,
    {
      provide: LLM_ADAPTERS,
      useFactory: (
        ollama: OllamaAdapter,
        openai: OpenAiAdapter,
        lmManager: LmManagerAdapter,
        anthropic: AnthropicAdapter,
      ) => ({ ollama, openai, 'lm-manager': lmManager, anthropic }),
      inject: [OllamaAdapter, OpenAiAdapter, LmManagerAdapter, AnthropicAdapter],
    },
  ],
  exports: [LlmGatewayService],
})
export class LlmGatewayModule {}
