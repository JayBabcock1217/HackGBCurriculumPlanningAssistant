import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
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
 * OpenAIAdapter
 *
 * Wraps the official OpenAI SDK. Uses the chat completions API for chat
 * and the embeddings API for vectors. API key comes from OPENAI_API_KEY;
 * OPENAI_BASE_URL allows pointing at OpenAI-compatible gateways.
 */
@Injectable()
export class OpenAiAdapter implements LlmAdapter {
  private readonly logger = new Logger(OpenAiAdapter.name);
  readonly provider = 'openai';
  readonly capabilities = ['chat', 'embed', 'cloud'];

  private client: OpenAI | null = null;
  private clientKey = '';

  constructor(private readonly state: LlmGatewayState) {}

  // Read from the mutable state on every access so runtime changes (from the
  // settings page) take effect without a restart.
  private get config() {
    return this.state.current;
  }

  /**
   * Build (or rebuild) the OpenAI client from the active config. The OpenAI
   * SDK captures the key/baseURL at construction time, so we rebuild whenever
   * those change — the clientKey tracks whether a rebuild is needed.
   */
  private get clientOrThrow(): OpenAI {
    const cfg = this.config.openai;
    const key = `${cfg.apiKey ?? ''}|${cfg.baseURL ?? ''}`;
    if (this.client === null || key !== this.clientKey) {
      this.client = cfg.apiKey
        ? new OpenAI({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL || undefined,
          })
        : null;
      this.clientKey = key;
    }
    if (!this.client) {
      throw new LlmProviderError(
        'OpenAI provider selected but OPENAI_API_KEY is not set',
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
    const model = options.model || this.config.openai.chatModel;

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        },
        { signal: options.signal },
      );

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new LlmProviderError(
          `OpenAI chat returned no content (model: ${model})`,
          this.provider,
        );
      }

      return {
        content: choice.message.content,
        model: completion.model || model,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
            }
          : undefined,
      };
    } catch (err) {
      throw this.wrapError(err, 'chat', model);
    }
  }

  async embed(text: string, options: LlmEmbedOptions = {}): Promise<LlmEmbedResult> {
    return (await this.embedBatch([text], options))[0];
  }

  async embedBatch(texts: string[], options: LlmEmbedOptions = {}): Promise<LlmEmbedResult[]> {
    const client = this.clientOrThrow;
    const model = options.model || this.config.openai.embeddingModel;

    try {
      const response = await client.embeddings.create(
        {
          model,
          input: texts,
        },
        { signal: options.signal },
      );

      // Response items are not guaranteed to be in input order; sort by index.
      const sorted = [...response.data].sort((a, b) => a.index - b.index);
      return sorted.map((item) => ({
        embedding: item.embedding,
        model: response.model || model,
        dimensions: item.embedding.length,
      }));
    } catch (err) {
      throw this.wrapError(err, 'embed', model);
    }
  }

  private wrapError(err: unknown, operation: string, model: string): LlmProviderError {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`OpenAI ${operation} failed (model: ${model}): ${message.slice(0, 300)}`);
    if (message.includes('401') || /invalid api key|incorrect api key/i.test(message)) {
      return new LlmProviderError(
        'OpenAI rejected the API key (401). Check OPENAI_API_KEY.',
        this.provider,
        err,
      );
    }
    if (message.includes('model_not_found') || /does not exist|no such model/i.test(message)) {
      return new LlmProviderError(
        `OpenAI model not found: ${model}`,
        this.provider,
        err,
      );
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return new LlmProviderError('OpenAI request was aborted', this.provider, err);
    }
    return new LlmProviderError(
      `OpenAI ${operation} failed: ${message.slice(0, 300)}`,
      this.provider,
      err,
    );
  }
}
