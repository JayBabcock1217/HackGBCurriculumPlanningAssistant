/**
 * LLM Gateway configuration.
 *
 * Everything is env-var driven (see backend/.env.example and
 * docker-compose.yml), so switching providers never requires a code change.
 *
 * Precedence for each capability (chat / embedding):
 *   1. Explicit per-capability provider override
 *      (LLM_CHAT_PROVIDER / LLM_EMBEDDING_PROVIDER)
 *   2. Global LLM_PROVIDER
 *   3. Built-in default (ollama)
 */

export type LlmProviderName = 'ollama' | 'openai' | 'anthropic';

export interface LlmGatewayConfig {
  provider: LlmProviderName;
  chatProvider: LlmProviderName;
  embeddingProvider: LlmProviderName;
  defaultChatModel: string;
  defaultEmbeddingModel: string;

  ollama: { url: string; chatModel: string; embeddingModel: string };
  openai: { apiKey: string | null; chatModel: string; embeddingModel: string; baseURL: string };
  anthropic: { apiKey: string | null; chatModel: string; baseURL: string };
}

const PROVIDERS: LlmProviderName[] = ['ollama', 'openai', 'anthropic'];

function parseProvider(value: string | undefined, fallback: LlmProviderName): LlmProviderName {
  const v = (value || '').trim().toLowerCase();
  if (PROVIDERS.includes(v as LlmProviderName)) {
    return v as LlmProviderName;
  }
  return fallback;
}

export function loadLlmGatewayConfig(env: NodeJS.ProcessEnv = process.env): LlmGatewayConfig {
  const globalProvider = parseProvider(env.LLM_PROVIDER, 'ollama');

  return {
    provider: globalProvider,
    chatProvider: parseProvider(env.LLM_CHAT_PROVIDER, globalProvider),
    embeddingProvider: parseProvider(env.LLM_EMBEDDING_PROVIDER, globalProvider),
    defaultChatModel: env.LLM_CHAT_MODEL || '',
    defaultEmbeddingModel: env.LLM_EMBEDDING_MODEL || '',

    ollama: {
      url: env.OLLAMA_URL || 'http://localhost:11434',
      chatModel: env.OLLAMA_CHAT_MODEL || 'llama3.2:1b',
      embeddingModel: env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    },
    openai: {
      apiKey: env.OPENAI_API_KEY || null,
      chatModel: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      embeddingModel: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      baseURL: env.OPENAI_BASE_URL || '',
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || null,
      chatModel: env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-20250514',
      baseURL: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    },
  };
}
