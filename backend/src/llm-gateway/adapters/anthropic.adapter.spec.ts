import { AnthropicAdapter } from './anthropic.adapter';
import { loadLlmGatewayConfig, LlmGatewayConfig } from '../llm-gateway.config';
import { LlmProviderError } from '../llm-adapter.interface';

/**
 * Unit tests for AnthropicAdapter.
 *
 * The Anthropic client is replaced with a mock so no network calls are
 * made. Covers system-prompt extraction, response mapping, and the
 * embedding-capability error contract.
 */
describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  let config: LlmGatewayConfig;
  const messagesCreate = jest.fn();

  beforeEach(async () => {
    config = loadLlmGatewayConfig({ ANTHROPIC_API_KEY: 'sk-ant-test' });

    adapter = new AnthropicAdapter(config);
    (adapter as unknown as { client: unknown }).client = {
      messages: { create: messagesCreate },
    };
    messagesCreate.mockReset();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
    expect(adapter.provider).toBe('anthropic');
    expect(adapter.capabilities).toContain('chat');
    expect(adapter.capabilities).not.toContain('embed');
  });

  describe('chat', () => {
    it('extracts system messages into the system parameter', async () => {
      messagesCreate.mockResolvedValue({
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'You are a helpful teacher.' }],
        usage: { input_tokens: 12, output_tokens: 6 },
      });

      const result = await adapter.chat([
        { role: 'system', content: 'You are a curriculum assistant.' },
        { role: 'user', content: 'Plan a lesson.' },
      ]);

      const call = messagesCreate.mock.calls[0][0];
      expect(call.system).toBe('You are a curriculum assistant.');
      expect(call.messages).toEqual([{ role: 'user', content: 'Plan a lesson.' }]);
      expect(result.content).toBe('You are a helpful teacher.');
      expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 6 });
    });

    it('omits the system parameter when there is no system message', async () => {
      messagesCreate.mockResolvedValue({
        model: 'm',
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      await adapter.chat([{ role: 'user', content: 'hi' }]);

      expect(messagesCreate.mock.calls[0][0].system).toBeUndefined();
    });

    it('uses the default model and max_tokens when not specified', async () => {
      messagesCreate.mockResolvedValue({
        model: 'm',
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      await adapter.chat([{ role: 'user', content: 'hi' }]);

      const call = messagesCreate.mock.calls[0][0];
      expect(call.model).toBe(config.anthropic.chatModel);
      expect(call.max_tokens).toBe(1024);
    });

    it('respects explicit model and maxTokens', async () => {
      messagesCreate.mockResolvedValue({
        model: 'm',
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      await adapter.chat([{ role: 'user', content: 'hi' }], {
        model: 'claude-haiku',
        maxTokens: 99,
      });

      const call = messagesCreate.mock.calls[0][0];
      expect(call.model).toBe('claude-haiku');
      expect(call.max_tokens).toBe(99);
    });

    it('throws when the API key is missing', async () => {
      const noKeyAdapter = new AnthropicAdapter(
        loadLlmGatewayConfig({ ANTHROPIC_API_KEY: '' } as NodeJS.ProcessEnv),
      );
      await expect(noKeyAdapter.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(
        /ANTHROPIC_API_KEY/,
      );
    });

    it('maps invalid-key errors', async () => {
      messagesCreate.mockRejectedValue(new Error('401 invalid x-api-key provided'));

      const err = await adapter.chat([{ role: 'user', content: 'x' }]).catch((e) => e);

      expect(err).toBeInstanceOf(LlmProviderError);
      expect(err.message).toContain('API key');
    });

    it('maps abort errors', async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      messagesCreate.mockRejectedValue(abortErr);

      const err = await adapter.chat([{ role: 'user', content: 'x' }]).catch((e) => e);
      expect(err.message).toContain('aborted');
    });
  });

  describe('embed', () => {
    it('rejects embed calls with a clear configuration error', async () => {
      const err = await adapter.embed().catch((e) => e);
      expect(err).toBeInstanceOf(LlmProviderError);
      expect(err.message).toContain('does not support embeddings');
      expect(err.message).toContain('LLM_EMBEDDING_PROVIDER');
    });

    it('rejects embedBatch calls too', async () => {
      const err = await adapter.embedBatch(['a', 'b']).catch((e) => e);
      expect(err).toBeInstanceOf(LlmProviderError);
    });
  });
});
