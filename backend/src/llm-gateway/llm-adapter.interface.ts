export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Abort signal for cancellation / client disconnect. */
  signal?: AbortSignal;
}

export interface LlmChatResult {
  content: string;
  model: string;
  /** Token usage reported by the provider, when available. */
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface LlmEmbedOptions {
  model?: string;
  signal?: AbortSignal;
}

export interface LlmEmbedResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface LlmModelInfo {
  /** Model identifier as the server reports it (e.g. "llama3.2:1b"). */
  id: string;
  /** Human name, when the server provides one. */
  name?: string;
}

/**
 * LlmAdapter
 *
 * The single interface every LLM provider must implement. The gateway
 * (LlmGatewayService) resolves exactly one adapter per call based on
 * config, so the rest of the app never talks to a provider directly.
 */
export interface LlmAdapter {
  /** Provider identifier: 'ollama' | 'openai' | 'anthropic'. */
  readonly provider: string;
  /**
   * Human-readable capability summary, used by the /llm/providers endpoint.
   * Includes 'list-models' when the adapter can enumerate the server's models.
   */
  readonly capabilities: string[];

  chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult>;

  embed(text: string, options?: LlmEmbedOptions): Promise<LlmEmbedResult>;

  embedBatch(texts: string[], options?: LlmEmbedOptions): Promise<LlmEmbedResult[]>;

  /**
   * Enumerate the models available on the configured server. Used by the
   * settings page to offer a dropdown of real model names. Adapters that
   * can't list models (Anthropic) should throw a LlmProviderError with a
   * clear message.
   */
  listModels(): Promise<LlmModelInfo[]>;
}

/**
 * Errors thrown by adapters when a provider call fails.
 * The gateway maps these to HTTP 502 responses.
 */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
