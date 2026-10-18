import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import {
  LlmAdapter,
  LlmChatOptions,
  LlmChatResult,
  LlmEmbedOptions,
  LlmEmbedResult,
  LlmMessage,
  LlmProviderError,
} from './llm-adapter.interface';
import { loadLlmGatewayConfig, LlmProviderName } from './llm-gateway.config';
import type { LlmGatewayConfig } from './llm-gateway.config';
import { LLM_GATEWAY_CONFIG, LLM_ADAPTERS } from './llm-gateway.tokens';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';

/**
 * LlmGatewayService
 *
 * The single entry point the rest of the app uses to talk to an LLM.
 * Resolves the configured adapter per capability (chat / embedding),
 * applies the per-provider default model, and normalizes provider
 * errors into consistent 502 responses.
 *
 * Model resolution order:
 *   1. explicit model passed by the caller
 *   2. LLM_CHAT_MODEL / LLM_EMBEDDING_MODEL (global override)
 *   3. per-provider default (e.g. OLLAMA_CHAT_MODEL)
 */
@Injectable()
export class LlmGatewayService implements OnModuleInit {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly adapters: Record<LlmProviderName, LlmAdapter>;

  constructor(
    @Inject(LLM_GATEWAY_CONFIG) private readonly config: LlmGatewayConfig,
    @Inject(LLM_ADAPTERS) adapterMap: Partial<Record<LlmProviderName, LlmAdapter>>,
  ) {
    this.adapters = {
      ollama: adapterMap.ollama as OllamaAdapter,
      openai: adapterMap.openai as OpenAiAdapter,
      anthropic: adapterMap.anthropic as AnthropicAdapter,
    };
  }

  onModuleInit(): void {
    this.logger.log(
      `LLM Gateway ready — chat: ${this.config.chatProvider}` +
        (this.config.defaultChatModel ? ` (model: ${this.config.defaultChatModel})` : '') +
        `, embedding: ${this.config.embeddingProvider}` +
        (this.config.defaultEmbeddingModel ? ` (model: ${this.config.defaultEmbeddingModel})` : ''),
    );
  }

  async chat(
    messages: LlmMessage[],
    options: LlmChatOptions = {},
  ): Promise<LlmChatResult> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages must be a non-empty array');
    }
    for (const m of messages) {
      if (!m || typeof m.content !== 'string' || !['system', 'user', 'assistant'].includes(m.role)) {
        throw new BadRequestException(
          'each message must have role (system|user|assistant) and string content',
        );
      }
    }

    const adapter = this.adapters[this.config.chatProvider];
    const model = options.model || this.config.defaultChatModel || undefined;
    return this.call(() => adapter.chat(messages, { ...options, model }), adapter);
  }

  async embed(text: string, options: LlmEmbedOptions = {}): Promise<LlmEmbedResult> {
    if (typeof text !== 'string' || text.length === 0) {
      throw new BadRequestException('text must be a non-empty string');
    }
    const adapter = this.adapters[this.config.embeddingProvider];
    const model = options.model || this.config.defaultEmbeddingModel || undefined;
    return this.call(() => adapter.embed(text, { ...options, model }), adapter);
  }

  async embedBatch(texts: string[], options: LlmEmbedOptions = {}): Promise<LlmEmbedResult[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new BadRequestException('texts must be a non-empty array');
    }
    const adapter = this.adapters[this.config.embeddingProvider];
    const model = options.model || this.config.defaultEmbeddingModel || undefined;
    return this.call(() => adapter.embedBatch(texts, { ...options, model }), adapter);
  }

  /**
   * Capability report for /api/llm/providers.
   * `available` means the provider can currently serve that capability
   * (for cloud providers, that the API key is configured).
   */
  async listProviders(): Promise<
    Array<{
      provider: string;
      capabilities: string[];
      chatModel: string;
      embeddingModel: string | null;
      available: { chat: boolean; embed: boolean };
    }>
  > {
    return (Object.keys(this.adapters) as LlmProviderName[]).map((name) => {
      const adapter = this.adapters[name];
      const supportsEmbed = adapter.capabilities.includes('embed');
      let chatAvailable = true;
      let embedAvailable = supportsEmbed;
      if (name === 'openai') {
        chatAvailable = !!this.config.openai.apiKey;
        embedAvailable = supportsEmbed && !!this.config.openai.apiKey;
      } else if (name === 'anthropic') {
        chatAvailable = !!this.config.anthropic.apiKey;
      }
      return {
        provider: adapter.provider,
        capabilities: adapter.capabilities,
        chatModel:
          name === 'ollama'
            ? this.config.ollama.chatModel
            : name === 'openai'
              ? this.config.openai.chatModel
              : this.config.anthropic.chatModel,
        embeddingModel:
          name === 'ollama'
            ? this.config.ollama.embeddingModel
            : name === 'openai'
              ? this.config.openai.embeddingModel
              : null,
        available: { chat: chatAvailable, embed: embedAvailable },
      };
    });
  }

  private async call<T>(fn: () => Promise<T>, adapter: LlmAdapter): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof LlmProviderError) {
        this.logger.error(
          `LLM provider error (${adapter.provider}): ${err.message}`,
        );
        throw new HttpException(
          { error: 'LLM provider error', message: err.message, provider: adapter.provider },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw err;
    }
  }
}
