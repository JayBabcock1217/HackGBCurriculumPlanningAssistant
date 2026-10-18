import { LlmGatewayConfig } from './llm-gateway.config';
import { LlmGatewayState } from './llm-gateway.state';

/**
 * Test helper: wrap a plain config object in a real LlmGatewayState so
 * adapters can be constructed in unit tests (adapters now read from the
 * mutable state instead of receiving a frozen config).
 */
export function stateFromConfig(config: LlmGatewayConfig): LlmGatewayState {
  const state = new LlmGatewayState();
  (state as unknown as { config: LlmGatewayConfig }).config = config;
  return state;
}
