import { OllamaAdapter } from './ollama.adapter';
import { loadLlmGatewayConfig, LlmGatewayConfig } from '../llm-gateway.config';
import { stateFromConfig } from '../llm-gateway.state.spec-helper';

/**
 * Unit tests for OllamaAdapter. fetch is mocked so no real Ollama server
 * is needed (the real-server round trip lives in the e2e suite).
 */
describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;
  let config: LlmGatewayConfig;
  const fetchMock = jest.fn();

  beforeEach(async () => {
    config = loadLlmGatewayConfig({ OLLAMA_URL: 'http://ollama-test:11434' });
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();

    adapter = new OllamaAdapter(stateFromConfig(config));
  });

  function jsonResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  function errorResponse(status: number, body: string): Response {
    return {
      ok: false,
      status,
      json: async () => ({}),
      text: async () => body,
    } as Response;
  }

  it('should be defined', () => {
    expect(adapter).toBeDefined();
    expect(adapter.provider).toBe('ollama');
    expect(adapter.capabilities).toContain('chat');
    expect(adapter.capabilities).toContain('embed');
  });

  describe('chat', () => {
    it('posts to /api/chat with the default model and returns content', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          message: { content: '2 + 2 is 4' },
          model: 'llama3.2:1b',
          prompt_eval_count: 10,
          eval_count: 8,
        }),
      );

      const result = await adapter.chat([{ role: 'user', content: 'what is 2+2?' }]);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://ollama-test:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":false'),
        }),
      );
      const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(sent.model).toBe(config.ollama.chatModel);
      expect(sent.messages).toEqual([{ role: 'user', content: 'what is 2+2?' }]);

      expect(result.content).toBe('2 + 2 is 4');
      expect(result.model).toBe('llama3.2:1b');
      expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 8 });
    });

    it('respects an explicit model override', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: { content: 'ok' } }));

      await adapter.chat([{ role: 'user', content: 'hi' }], { model: 'mistral' });

      const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(sent.model).toBe('mistral');
    });

    it('strips a trailing slash from the Ollama URL', async () => {
      const slashConfig = loadLlmGatewayConfig({ OLLAMA_URL: 'http://host:11434/' });
      const slashAdapter = new OllamaAdapter(stateFromConfig(slashConfig));
      fetchMock.mockResolvedValue(jsonResponse({ message: { content: 'ok' } }));

      await slashAdapter.chat([{ role: 'user', content: 'hi' }]);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://host:11434/api/chat',
        expect.any(Object),
      );
    });

    it('throws LlmProviderError on non-2xx responses', async () => {
      fetchMock.mockResolvedValue(errorResponse(404, 'model "nope" not found'));

      const promise = adapter.chat([{ role: 'user', content: 'hi' }]);
      await expect(promise).rejects.toThrow(/not found|404/);
      const err = await promise.catch((e) => e);
      expect(err.provider).toBe('ollama');
    });

    it('wraps network failures (server down) in LlmProviderError', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const promise = adapter.chat([{ role: 'user', content: 'hi' }]);
      const err = await promise.catch((e) => e);
      expect(err.provider).toBe('ollama');
      expect(err.message).toContain('unreachable');
    });
  });

  describe('embed / embedBatch', () => {
    it('embeds a single text via /api/embed', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ embeddings: [[0.1, 0.2, 0.3]], model: 'nomic-embed-text' }),
      );

      const result = await adapter.embed('hello');

      const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(sent.model).toBe(config.ollama.embeddingModel);
      expect(sent.input).toEqual(['hello']);

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.dimensions).toBe(3);
    });

    it('embedBatch embeds multiple texts and returns them in order', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          embeddings: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        }),
      );

      const results = await adapter.embedBatch(['a', 'b', 'c']);

      expect(results).toHaveLength(3);
      expect(results[0].embedding).toEqual([1, 0, 0]);
      expect(results[2].embedding).toEqual([0, 0, 1]);
    });

    it('throws on malformed embedding responses', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ embeddings: [[0.1]] })); // 1 vec for 2 texts

      const promise = adapter.embedBatch(['a', 'b']);
      await expect(promise).rejects.toThrow(/malformed/i);
    });

    it('wraps network failures for embed too', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      const err = await adapter.embed('x').catch((e) => e);
      expect(err.message).toContain('unreachable');
    });
  });
});
