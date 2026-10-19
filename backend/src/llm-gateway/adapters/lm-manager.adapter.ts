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
 * LmManagerAdapter
 *
 * Adapter for a local LM Manager server (llm-gpu-manager). LM Manager is an
 * OpenAI-compatible gateway: it exposes /v1/chat/completions and /v1/models
 * and routes each chat request to the llama-server running the model that the
 * request's `model` field names (by alias). It does NOT expose an
 * /embeddings endpoint, so this adapter is chat-only — embeddings must be
 * served by another provider (Ollama by default; see llm-gateway.config.ts).
 *
 * A plain fetch() is used instead of the OpenAI SDK because LM Manager's
 * responses carry a non-standard `reasoning_content` field alongside `content`
 * (thinking models) and the SDK's strict type validation can choke on it.
 *
 * Configuration (env / settings):
 *   LM_MANAGER_URL         base URL incl. /v1 (default http://local-host:12340/v1)
 *   LM_MANAGER_CHAT_MODEL  model alias to use when the caller passes none
 *   LM_MANAGER_API_KEY     sent as `Authorization: Bearer` (any non-empty value;
 *                          LM Manager ignores it, but some gateways require it)
 */
@Injectable()
export class LmManagerAdapter implements LlmAdapter {
  private readonly logger = new Logger(LmManagerAdapter.name);
  readonly provider = 'lm-manager';
  readonly capabilities = ['chat', 'local', 'list-models'];

  constructor(private readonly state: LlmGatewayState) {}

  // Read from the mutable state on every access so runtime changes (from the
  // settings page) take effect without a restart.
  private get config() {
    return this.state.current;
  }

  /**
   * Resolve the model alias to use. Order:
   *   1. explicit (passed by the caller)
   *   2. configured LM_MANAGER_CHAT_MODEL
   *   3. auto-discover: if LM Manager has exactly ONE running model, use it
   *      (zero-config default). If several are running, the teacher must pick
   *      one in Settings → AI so the app doesn't guess.
   */
  private async resolveModel(explicit?: string): Promise<string> {
    const model = explicit || this.config.lmManager.chatModel;
    if (model) return model;

    try {
      const running = await this.listModels();
      if (running.length === 1) {
        this.logger.log(`Auto-selected LM Manager model: ${running[0].id}`);
        return running[0].id;
      }
      if (running.length > 1) {
        throw new LlmProviderError(
          `LM Manager has ${running.length} models running (${running
            .map((m) => m.id)
            .join(', ')}). Pick one in Settings → AI (or set LM_MANAGER_CHAT_MODEL).`,
          this.provider,
        );
      }
    } catch (e) {
      if (e instanceof LlmProviderError && e.message.startsWith('LM Manager has')) {
        throw e;
      }
      // listModels failed (e.g. server unreachable) — fall through to the
      // "not configured" error below.
    }
    throw new LlmProviderError(
      'No LM Manager model is running or configured. Start a model in LM Manager, ' +
        'then pick it in Settings → AI (or set LM_MANAGER_CHAT_MODEL).',
      this.provider,
    );
  }

  private headers(): Record<string, string> {
    const key = this.config.lmManager.apiKey;
    return {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    };
  }

  async chat(
    messages: LlmMessage[],
    options: LlmChatOptions = {},
  ): Promise<LlmChatResult> {
    const model = await this.resolveModel(options.model);
    const path = '/chat/completions';
    const body = JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    // Try the configured base URL first; if it is unreachable (e.g. the Docker
    // bridge can't NAT to the host), retry via the host's bridge IP so a
    // firewall quirk doesn't break generation.
    let res: Response | undefined;
    let lastErr: unknown;
    for (const base of this.baseUrls()) {
      const url = `${base.replace(/\/+$/, '')}${path}`;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body,
          signal: options.signal,
        });
        if (res.ok) break;
        // Non-2xx from a reachable server is a real (non-network) error — use it.
        if (res.status >= 400 && res.status < 500) break;
      } catch (err) {
        lastErr = err;
        res = undefined;
      }
    }
    if (!res) {
      throw this.wrapError(lastErr, 'chat', model);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new LlmProviderError(
        `LM Manager chat failed (HTTP ${res.status}, model ${model}): ${text.slice(0, 300)}`,
        this.provider,
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new LlmProviderError('LM Manager returned invalid JSON for chat', this.provider);
    }

    // Some gateways stream an empty content with the answer in reasoning_content
    // when max_tokens is too small for a thinking model; treat that as a failure
    // with a clear hint rather than returning an empty resource.
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) {
      const reasoning = data?.choices?.[0]?.message?.reasoning_content;
      throw new LlmProviderError(
        `LM Manager chat returned no visible content (model: ${model})` +
          (reasoning
            ? ' — the model spent its token budget on reasoning. Raise max_tokens or pick a non-thinking model.'
            : ''),
        this.provider,
      );
    }

    return {
      content,
      model: data?.model || model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  async embed(_text: string, _options?: LlmEmbedOptions): Promise<LlmEmbedResult> {
    throw new LlmProviderError(
      'LM Manager does not expose an embeddings endpoint. Set the embedding ' +
        'provider to Ollama (or an OpenAI-compatible server) in Settings → AI.',
      this.provider,
    );
  }

  async embedBatch(_texts: string[], _options?: LlmEmbedOptions): Promise<LlmEmbedResult[]> {
    // LM Manager has no embeddings endpoint — throwing is the honest behavior;
    // the config layer routes embedding traffic to Ollama/OpenAI instead.
    throw new LlmProviderError(
      'LM Manager does not expose an embeddings endpoint. Set the embedding ' +
        'provider to Ollama (or an OpenAI-compatible server) in Settings → AI.',
      this.provider,
    );
  }

  /**
   * The base URLs to try, in order. The configured one first; if it used the
   * `local-host`/host.docker.internal token (i.e. points at the Docker host),
   * also try the host's bridge IP (172.17.0.1) as a fallback for hosts whose
   * firewall blocks container->host NAT via host.docker.internal.
   */
  private baseUrls(): string[] {
    const base = this.config.lmManager.baseURL;
    const urls = [base];
    if (/local-host|host\.docker\.internal/.test(base)) {
      // Replace the authority host with the default Linux Docker bridge IP.
      const bridge = base.replace(/\/\/[^/]+/, '//172.17.0.1');
      if (bridge !== base) urls.push(bridge);
    }
    return urls;
  }

  /**
   * List the models the LM Manager gateway has RUNNING (aliases of live
   * llama-servers). GET /v1/models returns { data: [{ id }] } where id is the
   * alias. Stopped models are intentionally excluded — a request to a stopped
   * model would 404.
   */
  async listModels(): Promise<LlmModelInfo[]> {
    const lastErr: { err?: unknown } = {};
    let res: Response | undefined;
    for (const base of this.baseUrls()) {
      const url = `${base.replace(/\/+$/, '')}/models`;
      try {
        res = await fetch(url, { headers: this.headers() });
        if (res.ok) break;
      } catch (err) {
        lastErr.err = err;
        res = undefined;
      }
    }
    if (!res) {
      throw this.wrapError(lastErr.err, 'list-models', '');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new LlmProviderError(
        `LM Manager model list failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
        this.provider,
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new LlmProviderError('LM Manager returned invalid JSON for model list', this.provider);
    }

    const rows: Array<{ id?: string; name?: string }> = data?.data ?? [];
    const models: LlmModelInfo[] = [];
    for (const row of rows) {
      if (row.id) {
        models.push({ id: row.id, name: row.name || undefined });
      }
    }
    return models;
  }

  private wrapError(err: unknown, operation: string, model: string): LlmProviderError {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`LM Manager ${operation} failed (model: ${model || 'n/a'}): ${message.slice(0, 300)}`);
    if (err instanceof Error && err.name === 'AbortError') {
      return new LlmProviderError('LM Manager request was aborted', this.provider, err);
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(message)) {
      return new LlmProviderError(
        `Cannot reach LM Manager at ${this.config.lmManager.baseURL}. ` +
          'Is the LM Manager gateway running (and reachable from the app container — ' +
          'use http://local-host:12340/v1 for the machine running the app)?',
        this.provider,
        err,
      );
    }
    return new LlmProviderError(
      `LM Manager ${operation} failed: ${message.slice(0, 300)}`,
      this.provider,
      err,
    );
  }
}
