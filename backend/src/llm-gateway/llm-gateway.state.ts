import { Injectable } from '@nestjs/common';
import { LlmGatewayConfig, loadLlmGatewayConfig } from './llm-gateway.config';

/**
 * LlmGatewayState
 *
 * A mutable, in-memory holder for the active LLM Gateway config.
 *
 * The config is seeded from environment variables at boot (see
 * loadLlmGatewayConfig), so the app works out of the box. It can then be
 * changed at runtime by the settings endpoints (PUT /api/llm/settings) —
 * that's how the in-app Settings page re-points the LLM server without
 * rebuilding the container or editing .env.
 *
 * The change is process-local: it resets to the env values the next time the
 * backend container restarts. For a persistent change, edit .env and rebuild.
 */
@Injectable()
export class LlmGatewayState {
  private config: LlmGatewayConfig;

  constructor() {
    // Seed from the environment. loadLlmGatewayConfig also resolves the
    // `local-host` token to host.docker.internal, so the in-app form can keep
    // working whether the container reaches the host or a Tailscale peer.
    this.config = loadLlmGatewayConfig();
  }

  /** The active config. Adapters and the gateway read this on every call. */
  get current(): LlmGatewayConfig {
    return this.config;
  }

  /**
   * Apply a settings update. Every field is optional; only provided fields are
   * changed, so the UI can send a partial body and still preserve the rest.
   * Returns a fresh copy of the config.
   */
  update(partial: Partial<LlmGatewayConfig>): LlmGatewayConfig {
    this.config = { ...this.config, ...partial };
    return this.config;
  }
}
