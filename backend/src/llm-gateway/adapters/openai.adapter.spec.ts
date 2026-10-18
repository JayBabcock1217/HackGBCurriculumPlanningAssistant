import { OpenAiAdapter } from './openai.adapter';
import { loadLlmGatewayConfig, LlmGatewayConfig } from '../llm-gateway.config';
import { LlmProviderError } from '../llm-adapter.interface';
import { stateFromConfig } from '../llm-gateway.state.spec-helper';

/**
 * Unit tests for OpenAiAdapter.
 *
 * No real API calls are made: the OpenAI client is replaced with a mock
 * object via module override, so the tests cover model resolution,
 * response mapping, and error handling (bad key, model not found, abort).
 */
describe('OpenAiAdapter', () => {
  let adapter: OpenAiAdapter;
  let config: LlmGatewayConfig;
  const chatCreate = jest.fn();
  const embeddingsCreate = jest.fn();

  beforeEach(async () => {
    config = loadLlmGatewayConfig({ OPENAI_API_KEY: 'sk-test' });

    adapter = new OpenAiAdapter(stateFromConfig(config));
    // Force the lazy client to be our mock so no real OpenAI SDK is built.
    const a = adapter as unknown as { client: unknown; clientKey: string };
    a.client = {
      chat: { completions: { create: chatCreate } },
      embeddings: { create: embeddingsCreate },
    };
    a.clientKey = 'sk-test|';
    chatCreate.mockReset();
    embeddingsCreate.mockReset();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
    expect(adapter.provider).toBe('openai');
    expect(adapter.capabilities).toContain('chat');
    expect(adapter.capabilities).toContain('embed');
  });

  describe('chat', () => {
    it('uses the default model when none is specified', async () => {
      chatCreate.mockResolvedValue({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'hello back' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      });

      const result = await adapter.chat([{ role: 'user', content: 'hello' }]);

      expect(chatCreate.mock.calls[0][0].model).toBe(config.openai.chatModel);
      expect(result.content).toBe('hello back');
      expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 3 });
    });

    it('respects an explicit model override', async () => {
      chatCreate.mockResolvedValue({
        model: 'gpt-4o',
        choices: [{ message: { content: 'hi' } }],
      });

      await adapter.chat([{ role: 'user', content: 'hi' }], { model: 'gpt-4o' });

      expect(chatCreate.mock.calls[0][0].model).toBe('gpt-4o');
    });

    it('maps temperature and maxTokens', async () => {
      chatCreate.mockResolvedValue({
        model: 'm',
        choices: [{ message: { content: 'hi' } }],
      });

      await adapter.chat([{ role: 'user', content: 'hi' }], {
        temperature: 0.1,
        maxTokens: 42,
      });

      expect(chatCreate.mock.calls[0][0].temperature).toBe(0.1);
      expect(chatCreate.mock.calls[0][0].max_tokens).toBe(42);
    });

    it('throws when the API key is missing', async () => {
      const noKeyAdapter = new OpenAiAdapter(
        stateFromConfig(loadLlmGatewayConfig({ OPENAI_API_KEY: '' } as NodeJS.ProcessEnv)),
      );
      await expect(noKeyAdapter.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(
        /OPENAI_API_KEY/,
      );
    });

    it('maps 401 invalid-key errors', async () => {
      chatCreate.mockRejectedValue(new Error('401 - invalid api key'));

      const err = await adapter
        .chat([{ role: 'user', content: 'x' }])
        .catch((e) => e);

      expect(err).toBeInstanceOf(LlmProviderError);
      expect(err.message).toContain('API key');
    });

    it('maps model-not-found errors', async () => {
      chatCreate.mockRejectedValue(new Error('model_not_found: model gpt-9 does not exist'));

      const err = await adapter
        .chat([{ role: 'user', content: 'x' }], { model: 'gpt-9' })
        .catch((e) => e);

      expect(err).toBeInstanceOf(LlmProviderError);
      expect(err.message).toContain('not found');
    });

    it('maps abort errors', async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      chatCreate.mockRejectedValue(abortErr);

      const err = await adapter.chat([{ role: 'user', content: 'x' }]).catch((e) => e);
      expect(err.message).toContain('aborted');
    });
  });

  describe('embed / embedBatch', () => {
    it('embeds a single text', async () => {
      embeddingsCreate.mockResolvedValue({
        model: 'text-embedding-3-small',
        data: [{ index: 0, embedding: [0.5, 0.6] }],
      });

      const result = await adapter.embed('some text');

      expect(embeddingsCreate.mock.calls[0][0].model).toBe(config.openai.embeddingModel);
      expect(result.embedding).toEqual([0.5, 0.6]);
      expect(result.dimensions).toBe(2);
    });

    it('sorts out-of-order embedding results by index', async () => {
      embeddingsCreate.mockResolvedValue({
        model: 'm',
        data: [
          { index: 1, embedding: [0.2] },
          { index: 0, embedding: [0.1] },
        ],
      });

      const results = await adapter.embedBatch(['a', 'b']);

      expect(results[0].embedding).toEqual([0.1]);
      expect(results[1].embedding).toEqual([0.2]);
    });

    it('throws when the API key is missing', async () => {
      const noKeyAdapter = new OpenAiAdapter(
        stateFromConfig(loadLlmGatewayConfig({ OPENAI_API_KEY: '' } as NodeJS.ProcessEnv)),
      );
      await expect(noKeyAdapter.embed('x')).rejects.toThrow(/OPENAI_API_KEY/);
    });
  });
});
