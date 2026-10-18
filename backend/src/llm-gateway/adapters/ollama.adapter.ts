import { Injectable, Logger } from '@nestjs/common';
import {
  LlmAdapter,
  LlmChatOptions,
  LlmChatResult,
  LlmEmbedOptions,
  LlmEmbedResult,
  LlmMessage,
  LlmModelInfo,
  LlmProviderError,
} from '../llm-adapter.interface';
import { LlmGatewayState } from '../llm-gateway.state';

/**
 * OllamaAdapter
 *
 * Talks to a local Ollama server using its HTTP API.
 *   - Chat: POST {url}/api/chat   (JSON body, non-streaming)
 *   - Embed: POST {url}/api/embed (returns { embeddings: number[][] })
 *
 * Ollama has no API key; auth failures surface as connection errors.
 */
@Injectable()
export class OllamaAdapter implements LlmAdapter {
  private readonly logger = new Logger(OllamaAdapter.name);

  readonly provider = 'ollama';
  readonly capabilities = ['chat', 'embed', 'local', 'list-models'];

  constructor(private readonly state: LlmGatewayState) {}

  // Read from the mutable state on every access so runtime changes (from the
  // settings page) take effect without a restart.
  private get config() {
    return this.state.current;
  }

  private get baseUrl(): string {
    return this.config.ollama.url.replace(/\/+$/, '');
  }

  async chat(
    messages: LlmMessage[],
    options: LlmChatOptions = {},
  ): Promise<LlmChatResult> {
    const model = options.model || this.config.ollama.chatModel;
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens,
      },
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (err) {
      throw this.wrapError(`Ollama unreachable at ${this.baseUrl}: ${String(err)}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LlmProviderError(
        `Ollama chat failed (${res.status}): ${detail.slice(0, 300)}`,
        this.provider,
      );
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      model?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message?.content ?? '',
      model: data.model || model,
      usage: {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
      },
    };
  }

  async embed(text: string, options: LlmEmbedOptions = {}): Promise<LlmEmbedResult> {
    const [result] = await this.embedBatch([text], options);
    return result;
  }

  async embedBatch(texts: string[], options: LlmEmbedOptions = {}): Promise<LlmEmbedResult[]> {
    const model = options.model || this.config.ollama.embeddingModel;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: texts }),
        signal: options.signal,
      });
    } catch (err) {
      throw this.wrapError(`Ollama unreachable at ${this.baseUrl}: ${String(err)}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LlmProviderError(
        `Ollama embed failed (${res.status}): ${detail.slice(0, 300)}`,
        this.provider,
      );
    }

    const data = (await res.json()) as {
      embeddings?: number[][];
      model?: string;
    };
    const embeddings = data.embeddings;
    if (!embeddings || !Array.isArray(embeddings) || embeddings.length !== texts.length) {
      throw new LlmProviderError(
        `Ollama embed returned malformed response for ${texts.length} input(s)`,
        this.provider,
      );
    }

    return embeddings.map((embedding) => ({
      embedding,
      model: data.model || model,
      dimensions: embedding.length,
    }));
  }

  /**
   * List the models pulled into this Ollama server. GET {url}/api/tags
   * returns { models: [{ name, model, ... }] }. We surface `name` (which
   * includes the tag, e.g. "llama3.2:1b") as the id.
   */
  async listModels(): Promise<LlmModelInfo[]> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/tags`);
    } catch (err) {
      throw this.wrapError(`Ollama unreachable at ${this.baseUrl}: ${String(err)}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LlmProviderError(
        `Ollama list-models failed (${res.status}): ${detail.slice(0, 300)}`,
        this.provider,
      );
    }

    const data = (await res.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const models = data.models ?? [];
    return models.map((m) => ({
      id: m.name || m.model || '',
      name: m.name || m.model,
    }));
  }

  private wrapError(message: string): LlmProviderError {
    this.logger.error(message);
    return new LlmProviderError(message, this.provider);
  }
}
