import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import {
  LlmAdapter,
  LlmChatResult,
  LlmEmbedResult,
  LlmMessage,
  LlmProviderError,
} from './llm-adapter.interface';
import { loadLlmGatewayConfig } from './llm-gateway.config';
import { LLM_GATEWAY_CONFIG, LLM_ADAPTERS } from './llm-gateway.tokens';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';

function makeAdapter(
  provider: string,
  overrides: Partial<LlmAdapter> = {},
): LlmAdapter {
  return {
    provider,
    capabilities: ['chat', 'embed'],
    chat: jest.fn(),
    embed: jest.fn(),
    embedBatch: jest.fn(),
    ...overrides,
  } as unknown as LlmAdapter;
}

async function buildModule(
  chatProvider: 'ollama' | 'openai' | 'anthropic',
  adapters: Partial<Record<'ollama' | 'openai' | 'anthropic', LlmAdapter>>,
  env: Record<string, string> = {},
): Promise<{ module: TestingModule; service: LlmGatewayService }> {
  const config = loadLlmGatewayConfig({
    LLM_PROVIDER: chatProvider,
    ...env,
  } as NodeJS.ProcessEnv);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LlmGatewayService,
      { provide: LLM_GATEWAY_CONFIG, useValue: config },
      { provide: LLM_ADAPTERS, useValue: adapters },
    ],
  }).compile();

  return { module, service: module.get<LlmGatewayService>(LlmGatewayService) };
}

describe('LlmGatewayService', () => {
  describe('chat', () => {
    it('routes to the configured chat provider', async () => {
      const adapter = makeAdapter('ollama', {
        chat: jest.fn().mockResolvedValue({ content: 'hi', model: 'llama3.2:1b' }),
      });
      const { service } = await buildModule('ollama', { ollama: adapter });

      const result = await service.chat([{ role: 'user', content: 'hello' }]);

      // No model override configured, so the gateway passes `model: undefined`
      // and the adapter applies its own default.
      expect(adapter.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hello' }],
        expect.objectContaining({ model: undefined }),
      );
      expect(result.content).toBe('hi');
    });

    it('passes an explicit model through to the adapter', async () => {
      const adapter = makeAdapter('openai', {
        chat: jest.fn().mockResolvedValue({ content: 'hi', model: 'gpt-4o-mini' }),
      });
      const { service } = await buildModule('openai', { openai: adapter }, {
        OPENAI_API_KEY: 'sk-test',
      });

      await service.chat([{ role: 'user', content: 'hello' }], { model: 'gpt-4o' });

      expect(adapter.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hello' }],
        expect.objectContaining({ model: 'gpt-4o' }),
      );
    });

    it('falls back to LLM_CHAT_MODEL global override', async () => {
      const adapter = makeAdapter('ollama', {
        chat: jest.fn().mockResolvedValue({ content: 'hi', model: 'x' }),
      });
      const { service } = await buildModule('ollama', { ollama: adapter }, {
        LLM_CHAT_MODEL: 'my-custom-model',
      });

      await service.chat([{ role: 'user', content: 'hello' }]);

      expect(adapter.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hello' }],
        expect.objectContaining({ model: 'my-custom-model' }),
      );
    });

    it('rejects an empty message array', async () => {
      const { service } = await buildModule('ollama', {
        ollama: makeAdapter('ollama'),
      });
      await expect(service.chat([])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects messages with an invalid role', async () => {
      const { service } = await buildModule('ollama', {
        ollama: makeAdapter('ollama'),
      });
      const bad = [{ role: 'tool', content: 'x' }] as unknown as LlmMessage[];
      await expect(service.chat(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects messages with missing content', async () => {
      const { service } = await buildModule('ollama', {
        ollama: makeAdapter('ollama'),
      });
      const bad = [{ role: 'user' }] as unknown as LlmMessage[];
      await expect(service.chat(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps LlmProviderError to a 502 response', async () => {
      const adapter = makeAdapter('ollama', {
        chat: jest
          .fn()
          .mockRejectedValue(
            new LlmProviderError('Ollama unreachable at http://x:11434', 'ollama'),
          ),
      });
      const { service } = await buildModule('ollama', { ollama: adapter });

      const promise = service.chat([{ role: 'user', content: 'hello' }]);
      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await expect(promise).rejects.toMatchObject({ status: 502 });
    });
  });

  describe('embed / embedBatch', () => {
    it('routes to the configured embedding provider', async () => {
      const result: LlmEmbedResult = {
        embedding: [0.1, 0.2, 0.3],
        model: 'nomic-embed-text',
        dimensions: 3,
      };
      const adapter = makeAdapter('ollama', { embed: jest.fn().mockResolvedValue(result) });
      const { service } = await buildModule('ollama', { ollama: adapter });

      const out = await service.embed('some text');

      // The adapter receives `model: undefined` and applies its own default
      // (nomic-embed-text from config) — the gateway stays provider-agnostic.
      expect(adapter.embed).toHaveBeenCalledWith(
        'some text',
        expect.objectContaining({ model: undefined }),
      );
      expect(out).toEqual(result);
    });

    it('embedBatch routes to the embedding provider', async () => {
      const results: LlmEmbedResult[] = [
        { embedding: [0.1], model: 'm', dimensions: 1 },
        { embedding: [0.2], model: 'm', dimensions: 1 },
      ];
      const adapter = makeAdapter('ollama', {
        embedBatch: jest.fn().mockResolvedValue(results),
      });
      const { service } = await buildModule('ollama', { ollama: adapter });

      const out = await service.embedBatch(['a', 'b']);

      expect(adapter.embedBatch).toHaveBeenCalledWith(
        ['a', 'b'],
        expect.any(Object),
      );
      expect(out).toEqual(results);
    });

    it('embedding provider can differ from chat provider', async () => {
      const chatAdapter = makeAdapter('openai', {
        chat: jest.fn().mockResolvedValue({ content: 'ok', model: 'gpt' }),
      });
      const embedAdapter = makeAdapter('ollama', {
        embed: jest.fn().mockResolvedValue({ embedding: [1], model: 'nomic', dimensions: 1 }),
      });
      const config = loadLlmGatewayConfig({
        LLM_CHAT_PROVIDER: 'openai',
        LLM_EMBEDDING_PROVIDER: 'ollama',
        OPENAI_API_KEY: 'sk-test',
      } as NodeJS.ProcessEnv);
      const module = await Test.createTestingModule({
        providers: [
          LlmGatewayService,
          { provide: LLM_GATEWAY_CONFIG, useValue: config },
          { provide: LLM_ADAPTERS, useValue: { openai: chatAdapter, ollama: embedAdapter } },
        ],
      }).compile();
      const service = module.get<LlmGatewayService>(LlmGatewayService);

      await service.chat([{ role: 'user', content: 'hi' }]);
      await service.embed('text');

      expect(chatAdapter.chat).toHaveBeenCalled();
      expect(embedAdapter.embed).toHaveBeenCalled();
    });

    it('rejects empty text', async () => {
      const { service } = await buildModule('ollama', {
        ollama: makeAdapter('ollama'),
      });
      await expect(service.embed('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty texts array', async () => {
      const { service } = await buildModule('ollama', {
        ollama: makeAdapter('ollama'),
      });
      await expect(service.embedBatch([])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps embedding provider errors to 502 as well', async () => {
      const adapter = makeAdapter('ollama', {
        embed: jest
          .fn()
          .mockRejectedValue(new LlmProviderError('model not found', 'ollama')),
      });
      const { service } = await buildModule('ollama', { ollama: adapter });
      const promise = service.embed('text');
      await expect(promise).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('listProviders', () => {
    it('reports all three providers with capability flags', async () => {
      const { service } = await buildModule('ollama', {
        ollama: makeAdapter('ollama'),
        openai: makeAdapter('openai', { capabilities: ['chat', 'embed', 'cloud'] }),
        anthropic: makeAdapter('anthropic', { capabilities: ['chat', 'cloud'] }),
      });

      const providers = await service.listProviders();

      expect(providers).toHaveLength(3);
      const ollama = providers.find((p) => p.provider === 'ollama');
      expect(ollama?.available.chat).toBe(true);
      expect(ollama?.available.embed).toBe(true);

      // No API key configured for openai/anthropic in the default config
      const openai = providers.find((p) => p.provider === 'openai');
      expect(openai?.available.chat).toBe(false);
      expect(openai?.available.embed).toBe(false);

      const anthropic = providers.find((p) => p.provider === 'anthropic');
      expect(anthropic?.available.chat).toBe(false);
      expect(anthropic?.available.embed).toBe(false);
    });

    it('marks cloud providers available when keys are present', async () => {
      const config = loadLlmGatewayConfig({
        OPENAI_API_KEY: 'sk-test',
        ANTHROPIC_API_KEY: 'sk-ant-test',
      } as NodeJS.ProcessEnv);
      const module = await Test.createTestingModule({
        providers: [
          LlmGatewayService,
          { provide: LLM_GATEWAY_CONFIG, useValue: config },
          {
            provide: LLM_ADAPTERS,
            useValue: {
              ollama: makeAdapter('ollama'),
              openai: makeAdapter('openai'),
              anthropic: makeAdapter('anthropic', { capabilities: ['chat', 'cloud'] }),
            },
          },
        ],
      }).compile();
      const service = module.get<LlmGatewayService>(LlmGatewayService);

      const providers = await service.listProviders();
      const openai = providers.find((p) => p.provider === 'openai');
      expect(openai?.available.chat).toBe(true);
      expect(openai?.available.embed).toBe(true);

      const anthropic = providers.find((p) => p.provider === 'anthropic');
      expect(anthropic?.available.chat).toBe(true);
      expect(anthropic?.available.embed).toBe(false); // no embed support
    });
  });
});
