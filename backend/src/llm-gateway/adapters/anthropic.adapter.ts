import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  LlmAdapter,
  LlmChatOptions,
  LlmChatResult,
  LlmEmbedOptions,
  LlmEmbedResult,
  LlmMessage,
  LlmProviderError,
} from '../llm-adapter.interface';
import { LlmGatewayState } from '../llm-gateway.state';

/**
 * AnthropicAdapter
 *
 * Wraps the official Anthropic SDK for chat completions.
 *
 * Embeddings: Anthropic's own embedding API (messages.v1) requires a
 * `document`-type input, which doesn't fit our use case of embedding
 * arbitrary curriculum chunks. So this adapter does not support embed;
 * the gateway must be configured with a different embedding provider
 * (Ollama or OpenAI) when Anthropic is used for chat.
 */
@Injectable()
export class AnthropicAdapter implements LlmAdapter {
  private readonly logger = new Logger(AnthropicAdapter.name);
  readonly provider = 'anthropic';
  readonly capabilities = ['chat', 'cloud'];

  private client: Anthropic | null = null;
  private clientKey = '';

  constructor(private readonly state: LlmGatewayState) {}

  // Read from the mutable state on every access so runtime changes (from the
  // settings page) take effect without a restart.
  private get config() {
    return this.state.current;
  }

  /**
   * Build (or rebuild) the Anthropic client from the active config. The SDK
   * captures the key/baseURL at construction time, so we rebuild whenever
   * those change — clientKey tracks whether a rebuild is needed.
   */
  private get clientOrThrow(): Anthropic {
    const cfg = this.config.anthropic;
    const key = `${cfg.apiKey ?? ''}|${cfg.baseURL ?? ''}`;
    if (this.client === null || key !== this.clientKey) {
      this.client = cfg.apiKey
        ? new Anthropic({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL,
          })
        : null;
      this.clientKey = key;
    }
    if (!this.client) {
      throw new LlmProviderError(
        'Anthropic provider selected but ANTHROPIC_API_KEY is not set',
        this.provider,
      );
    }
    return this.client;
  }

  async chat(
    messages: LlmMessage[],
    options: LlmChatOptions = {},
  ): Promise<LlmChatResult> {
    const client = this.clientOrThrow;
    const model = options.model || this.config.anthropic.chatModel;

    // Anthropic expects the system prompt as a top-level parameter, not
    // as a 'system' message.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: options.maxTokens ?? 1024,
          system: system || undefined,
          messages: conversation,
          temperature: options.temperature ?? 0.7,
        },
        { signal: options.signal },
      );

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      if (!text) {
        throw new LlmProviderError(
          `Anthropic chat returned no text content (model: ${model})`,
          this.provider,
        );
      }

      return {
        content: text,
        model: response.model || model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      throw this.wrapError(err, model);
    }
  }

  async embed(): Promise<LlmEmbedResult> {
    throw new LlmProviderError(
      'Anthropic adapter does not support embeddings. ' +
        'Set LLM_EMBEDDING_PROVIDER=ollama (or openai) to use a different provider for embeddings.',
      this.provider,
    );
  }

  async embedBatch(texts: string[]): Promise<LlmEmbedResult[]> {
    throw new LlmProviderError(
      `Anthropic adapter does not support embeddings (got ${texts.length} text(s)). ` +
        'Set LLM_EMBEDDING_PROVIDER=ollama (or openai) to use a different provider for embeddings.',
      this.provider,
    );
  }

  private wrapError(err: unknown, model: string): LlmProviderError {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Anthropic chat failed (model: ${model}): ${message.slice(0, 300)}`);
    if (/invalid x-api-key|authentication/i.test(message)) {
      return new LlmProviderError(
        'Anthropic rejected the API key. Check ANTHROPIC_API_KEY.',
        this.provider,
        err,
      );
    }
    if (/not found|no hosts available|model .* does not exist/i.test(message)) {
      return new LlmProviderError(`Anthropic model not found: ${model}`, this.provider, err);
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return new LlmProviderError('Anthropic request was aborted', this.provider, err);
    }
    return new LlmProviderError(
      `Anthropic chat failed: ${message.slice(0, 300)}`,
      this.provider,
      err,
    );
  }
}
