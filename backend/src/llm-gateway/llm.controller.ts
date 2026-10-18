import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import { LlmMessage } from './llm-adapter.interface';
import { LlmProviderName } from './llm-gateway.config';
import { Roles } from '../database/auth/roles.decorator';

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
 * Body for PUT /api/llm/settings. Every field is optional so the UI can send a
 * partial update and the rest is preserved. API keys use the convention:
 *   - ""        -> clear the key
 *   - "****abcd"-> masked value, ignored (keeps the existing key)
 *   - other     -> set a new key
 */
export interface LlmSettingsDto {
  chatProvider?: string;
  embeddingProvider?: string;
  defaultChatModel?: string;
  defaultEmbeddingModel?: string;
  ollama?: { url?: string; chatModel?: string; embeddingModel?: string };
  openai?: {
    apiKey?: string;
    chatModel?: string;
    embeddingModel?: string;
    baseURL?: string;
  };
  anthropic?: { apiKey?: string; chatModel?: string; baseURL?: string };
}

/**
 * LlmController
 *
 * HTTP surface for the LLM Gateway.
 *   GET  /api/llm/providers   — which providers are configured and their capabilities
 *   POST /api/llm/chat        — chat completion via the configured chat provider
 *   POST /api/llm/embeddings  — single (text) or batch (texts) embeddings
 *
 * Settings (admin-only):
 *   GET  /api/llm/settings    — current LLM settings (API keys masked)
 *   PUT  /api/llm/settings    — update the LLM server address / provider / models
 *   POST /api/llm/test        — test the chat + embedding connection
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

  @Roles('admin')
  @Get('settings')
  settings() {
    return this.gateway.getSettings();
  }

  @Roles('admin')
  @Put('settings')
  updateSettings(@Body() body: LlmSettingsDto) {
    return this.gateway.updateSettings({
      ...body,
      chatProvider: body.chatProvider as LlmProviderName | undefined,
      embeddingProvider: body.embeddingProvider as LlmProviderName | undefined,
    });
  }

  @Roles('admin')
  @Post('test')
  test() {
    return this.gateway.testConnection();
  }
}
