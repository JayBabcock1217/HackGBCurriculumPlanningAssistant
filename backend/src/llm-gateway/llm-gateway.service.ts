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
import { LlmGatewayState } from './llm-gateway.state';
import { LLM_ADAPTERS } from './llm-gateway.tokens';
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
    private readonly state: LlmGatewayState,
    @Inject(LLM_ADAPTERS) adapterMap: Partial<Record<LlmProviderName, LlmAdapter>>,
  ) {
    this.adapters = {
      ollama: adapterMap.ollama as OllamaAdapter,
      openai: adapterMap.openai as OpenAiAdapter,
      anthropic: adapterMap.anthropic as AnthropicAdapter,
    };
  }

  // Read from the mutable state on every access so runtime changes (from the
  // settings page) take effect immediately, without a restart.
  private get config(): LlmGatewayConfig {
    return this.state.current;
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

  /**
   * The current LLM settings, in a shape the settings UI can render and send
   * back. `apiKey` is returned masked (the UI never needs the real value, and
   * it shouldn't be echoed back to the browser).
   */
  getSettings(): {
    chatProvider: LlmProviderName;
    embeddingProvider: LlmProviderName;
    ollama: { url: string; chatModel: string; embeddingModel: string };
    openai: {
      apiKey: string | null;
      apiKeyMasked: string | null;
      chatModel: string;
      embeddingModel: string;
      baseURL: string;
    };
    anthropic: { apiKey: string | null; apiKeyMasked: string | null; chatModel: string; baseURL: string };
    defaultChatModel: string;
    defaultEmbeddingModel: string;
  } {
    const cfg = this.config;
    return {
      chatProvider: cfg.chatProvider,
      embeddingProvider: cfg.embeddingProvider,
      ollama: { ...cfg.ollama },
      openai: {
        ...cfg.openai,
        apiKeyMasked: cfg.openai.apiKey ? this.maskKey(cfg.openai.apiKey) : null,
      },
      anthropic: {
        ...cfg.anthropic,
        apiKeyMasked: cfg.anthropic.apiKey
          ? this.maskKey(cfg.anthropic.apiKey)
          : null,
      },
      defaultChatModel: cfg.defaultChatModel,
      defaultEmbeddingModel: cfg.defaultEmbeddingModel,
    };
  }

  /**
   * Apply a settings update from the UI. Only provided fields are changed.
   * API keys: an empty string means "clear", a non-empty string sets it, and a
   * masked value (e.g. "****abcd") is ignored so the UI can round-trip the
   * masked display without clobbering the real key.
   */
  updateSettings(
    update: Partial<
      Pick<
        LlmGatewayConfig,
        'chatProvider' | 'embeddingProvider' | 'defaultChatModel' | 'defaultEmbeddingModel'
      >
    > & {
      ollama?: Partial<LlmGatewayConfig['ollama']>;
      openai?: Partial<Omit<LlmGatewayConfig['openai'], 'apiKey'> & { apiKey?: string }>;
      anthropic?: Partial<Omit<LlmGatewayConfig['anthropic'], 'apiKey'> & { apiKey?: string }>;
    },
  ): LlmGatewayConfig {
    const cfg = this.config;
    const next: LlmGatewayConfig = {
      ...cfg,
      chatProvider: update.chatProvider ?? cfg.chatProvider,
      embeddingProvider: update.embeddingProvider ?? cfg.embeddingProvider,
      defaultChatModel: update.defaultChatModel ?? cfg.defaultChatModel,
      defaultEmbeddingModel: update.defaultEmbeddingModel ?? cfg.defaultEmbeddingModel,
      ollama: { ...cfg.ollama, ...(update.ollama ?? {}) },
      openai: {
        ...cfg.openai,
        ...(update.openai ?? {}),
        apiKey: this.applyKey(cfg.openai.apiKey, update.openai?.apiKey),
      },
      anthropic: {
        ...cfg.anthropic,
        ...(update.anthropic ?? {}),
        apiKey: this.applyKey(cfg.anthropic.apiKey, update.anthropic?.apiKey),
      },
    };
    // Provider-specific URL token resolution already happened at load time; if
    // the user typed a fresh local-host URL, resolve it now so it points at the
    // Docker host inside the container.
    const resolved = loadLlmGatewayConfig({
      ...process.env,
      LLM_PROVIDER: next.provider,
      LLM_CHAT_PROVIDER: next.chatProvider,
      LLM_EMBEDDING_PROVIDER: next.embeddingProvider,
      LLM_CHAT_MODEL: next.defaultChatModel,
      LLM_EMBEDDING_MODEL: next.defaultEmbeddingModel,
      OLLAMA_URL: next.ollama.url,
      OLLAMA_CHAT_MODEL: next.ollama.chatModel,
      OLLAMA_EMBEDDING_MODEL: next.ollama.embeddingModel,
      OPENAI_API_KEY: next.openai.apiKey ?? '',
      OPENAI_CHAT_MODEL: next.openai.chatModel,
      OPENAI_EMBEDDING_MODEL: next.openai.embeddingModel,
      OPENAI_BASE_URL: next.openai.baseURL,
      ANTHROPIC_API_KEY: next.anthropic.apiKey ?? '',
      ANTHROPIC_CHAT_MODEL: next.anthropic.chatModel,
      ANTHROPIC_BASE_URL: next.anthropic.baseURL,
    });
    this.state.update({
      chatProvider: resolved.chatProvider,
      embeddingProvider: resolved.embeddingProvider,
      defaultChatModel: resolved.defaultChatModel,
      defaultEmbeddingModel: resolved.defaultEmbeddingModel,
      ollama: resolved.ollama,
      openai: resolved.openai,
      anthropic: resolved.anthropic,
    });
    this.logger.log(
      `LLM settings updated — chat: ${resolved.chatProvider}, embed: ${resolved.embeddingProvider}`,
    );
    return this.config;
  }

  private applyKey(existing: string | null, incoming?: string): string | null {
    if (incoming === undefined) return existing;
    if (incoming === '') return null; // explicit clear
    if (incoming.startsWith('****')) return existing; // masked value, ignore
    return incoming;
  }

  private maskKey(key: string): string {
    return key.length <= 4 ? '****' : `****${key.slice(-4)}`;
  }

  /**
   * Test the connection to the currently configured chat + embedding server(s).
   * Used by the settings "Test connection" button. Returns a per-capability
   * result so the UI can show exactly what worked and what didn't.
   */
  async testConnection(): Promise<{
    chat: { ok: boolean; provider: string; model: string; message?: string };
    embed: { ok: boolean; provider: string; model: string; message?: string };
  }> {
    const chatAdapter = this.adapters[this.config.chatProvider];
    const chatModel = this.config.defaultChatModel || undefined;
    const chat = await this.safeTest(
      () =>
        chatAdapter.chat(
          [{ role: 'user', content: 'Reply with the single word: ok' }],
          { model: chatModel, maxTokens: 8 },
        ),
      'chat',
      chatAdapter.provider,
      chatModel ?? '',
    );

    const embedAdapter = this.adapters[this.config.embeddingProvider];
    const embedModel = this.config.defaultEmbeddingModel || undefined;
    const embed = await this.safeTest(
      () => embedAdapter.embed('hello', { model: embedModel }),
      'embed',
      embedAdapter.provider,
      embedModel ?? '',
    );

    return { chat, embed };
  }

  private async safeTest(
    fn: () => Promise<unknown>,
    capability: 'chat' | 'embed',
    provider: string,
    model: string,
  ): Promise<{ ok: boolean; provider: string; model: string; message?: string }> {
    try {
      const started = Date.now();
      await fn();
      return {
        ok: true,
        provider,
        model,
        message: `${capability === 'chat' ? 'Chat' : 'Embed'} succeeded in ${Date.now() - started}ms`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM ${capability} test failed (${provider}): ${message.slice(0, 200)}`);
      return { ok: false, provider, model, message: message.slice(0, 300) };
    }
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
