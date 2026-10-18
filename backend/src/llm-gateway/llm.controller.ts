import { Body, Controller, Get, Post } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import { LlmMessage } from './llm-adapter.interface';

export interface LlmChatDto {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmEmbedDto {
  text?: string;
  texts?: string[];
  model?: string;
}

/**
 * LlmController
 *
 * HTTP surface for the LLM Gateway.
 *   GET  /api/llm/providers   — which providers are configured and their capabilities
 *   POST /api/llm/chat        — chat completion via the configured chat provider
 *   POST /api/llm/embeddings  — single (text) or batch (texts) embeddings
 */
@Controller('llm')
export class LlmController {
  constructor(private readonly gateway: LlmGatewayService) {}

  @Get('providers')
  providers() {
    return this.gateway.listProviders();
  }

  @Post('chat')
  chat(@Body() body: LlmChatDto) {
    return this.gateway.chat(body.messages, {
      model: body.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });
  }

  @Post('embeddings')
  embeddings(@Body() body: LlmEmbedDto) {
    if (body.texts) {
      return this.gateway.embedBatch(body.texts, { model: body.model });
    }
    if (body.text) {
      return this.gateway.embed(body.text, { model: body.model });
    }
    throw new Error('Provide either "text" (single) or "texts" (batch)');
  }
}
