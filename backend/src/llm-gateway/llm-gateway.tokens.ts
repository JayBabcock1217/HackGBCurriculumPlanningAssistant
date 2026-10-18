/**
 * DI tokens for the LLM Gateway.
 *
 * Kept in their own file so the config, service, adapters, and module
 * can all reference them without circular imports.
 */

/** Token for the LlmGatewayConfig instance. */
export const LLM_GATEWAY_CONFIG = 'LLM_GATEWAY_CONFIG';

/**
 * Token for the map of provider adapters:
 *   { ollama: OllamaAdapter, openai: OpenAiAdapter, anthropic: AnthropicAdapter }
 */
export const LLM_ADAPTERS = 'LLM_ADAPTERS';
