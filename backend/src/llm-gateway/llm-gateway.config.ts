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

/**
 * LLM_LOCAL_HOST is a platform-independent token for "the machine that is
 * running the app" (the Docker host). A local LLM server started on the dev's
 * laptop/desktop — e.g. Ollama, LM Studio, llama.cpp server, vLLM — listens on
 * that host's localhost, which is NOT reachable from inside a container via
 * `localhost`. Instead, use it like:
 *
 *   OLLAMA_URL=http://local-host:11434
 *   OPENAI_BASE_URL=http://local-host:1234/v1
 *
 *   - Inside a Docker container (any OS) it resolves to the Docker host
 *     (`host.docker.internal` on macOS/Windows, `host-gateway` on Linux, via
 *     docker-compose's extra_hosts), which points at the host's loopback.
 *
 * When running the backend natively (no container) just put your real local
 * address in the URL (e.g. http://127.0.0.1:11434), or set HOST_DOCKER_INTERNAL
 * to override the resolved host in a container.
 *
 * For an AI server on a DIFFERENT machine reached over Tailscale, use its
 * Tailscale IP (100.x.y.z) or MagicDNS name directly, e.g.
 * OLLAMA_URL=http://100.64.0.5:11434 — and set TAILOSCALE_INTERFACE=1 in
 * docker-compose so the container can reach Tailscale peers (see .env.example).
 */
export const LOCAL_HOST_TOKEN = 'local-host';

export function resolveLocalHostToken(url: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!url.includes(LOCAL_HOST_TOKEN)) {
    return url;
  }
  const host = (env.HOST_DOCKER_INTERNAL || '').trim() || 'host.docker.internal';
  // Replace only the authority host so the port and any path survive.
  return url.replace(LOCAL_HOST_TOKEN, host);
}

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
      url: resolveLocalHostToken(env.OLLAMA_URL || 'http://localhost:11434', env),
      chatModel: env.OLLAMA_CHAT_MODEL || 'llama3.2:1b',
      embeddingModel: env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    },
    openai: {
      apiKey: env.OPENAI_API_KEY || null,
      chatModel: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      embeddingModel: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      baseURL: resolveLocalHostToken(env.OPENAI_BASE_URL || '', env),
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || null,
      chatModel: env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-20250514',
      baseURL: resolveLocalHostToken(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com', env),
    },
  };
}
