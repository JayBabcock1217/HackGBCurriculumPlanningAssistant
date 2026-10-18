'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings as SettingsIcon,
  Loader2,
  CloudOff,
  CheckCircle2,
  XCircle,
  Plug,
  Save,
  Cpu,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  getLlmSettings,
  updateLlmSettings,
  testLlmConnection,
  getLlmModels,
  type LlmProviderName,
  type LlmSettings,
  type LlmTestResult,
  type LlmModelInfo,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { useI18n } from '@/lib/i18n';

const PROVIDERS: Array<{ value: LlmProviderName; label: string; hint: string }> = [
  { value: 'ollama', label: 'Ollama', hint: 'Local model server (default port 11434)' },
  { value: 'openai', label: 'OpenAI-compatible', hint: 'LM Studio, llama.cpp, vLLM, Ollama /v1, or real OpenAI' },
  { value: 'anthropic', label: 'Anthropic', hint: 'Claude (chat only; embeddings need Ollama/OpenAI)' },
];

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      {children}
    </label>
  );
}

/**
 * A model picker: a free-text input backed by a <datalist> of the models the
 * server reported. Free text is always allowed (so a model not yet in the list
 * can be typed), but the dropdown offers the real names.
 */
function ModelField({
  value,
  onChange,
  listId,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  listId: string;
  options: LlmModelInfo[];
  placeholder?: string;
}) {
  return (
    <>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
      />
      <datalist id={listId}>
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name && m.name !== m.id ? m.name : ''}
          </option>
        ))}
      </datalist>
    </>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [listing, setListing] = useState<'chat' | 'embed' | null>(null);
  const [chatModels, setChatModels] = useState<LlmModelInfo[]>([]);
  const [embedModels, setEmbedModels] = useState<LlmModelInfo[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Form state (strings so inputs work freely before save).
  const [chatProvider, setChatProvider] = useState<LlmProviderName>('ollama');
  const [embeddingProvider, setEmbeddingProvider] = useState<LlmProviderName>('ollama');
  const [defaultChatModel, setDefaultChatModel] = useState('');
  const [defaultEmbeddingModel, setDefaultEmbeddingModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaChatModel, setOllamaChatModel] = useState('');
  const [ollamaEmbedModel, setOllamaEmbedModel] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiChatModel, setOpenaiChatModel] = useState('');
  const [openaiEmbedModel, setOpenaiEmbedModel] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState('');
  const [anthropicChatModel, setAnthropicChatModel] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getLlmSettings();
      setSettings(s);
      setChatProvider(s.chatProvider);
      setEmbeddingProvider(s.embeddingProvider);
      setDefaultChatModel(s.defaultChatModel);
      setDefaultEmbeddingModel(s.defaultEmbeddingModel);
      setOllamaUrl(s.ollama.url);
      setOllamaChatModel(s.ollama.chatModel);
      setOllamaEmbedModel(s.ollama.embeddingModel);
      setOpenaiBaseUrl(s.openai.baseURL);
      setOpenaiChatModel(s.openai.chatModel);
      setOpenaiEmbedModel(s.openai.embeddingModel);
      setOpenaiKey(s.openai.apiKeyMasked ?? '');
      setAnthropicBaseUrl(s.anthropic.baseURL);
      setAnthropicChatModel(s.anthropic.chatModel);
      setAnthropicKey(s.anthropic.apiKeyMasked ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    setTestResult(null);
    try {
      const body: Parameters<typeof updateLlmSettings>[0] = {
        chatProvider,
        embeddingProvider,
        defaultChatModel,
        defaultEmbeddingModel,
        ollama: {
          url: ollamaUrl,
          chatModel: ollamaChatModel,
          embeddingModel: ollamaEmbedModel,
        },
        openai: {
          baseURL: openaiBaseUrl,
          chatModel: openaiChatModel,
          embeddingModel: openaiEmbedModel,
          // Send the key only if the user typed something new (not the masked value).
          apiKey: openaiKey && !openaiKey.startsWith('****') ? openaiKey : undefined,
        },
        anthropic: {
          baseURL: anthropicBaseUrl,
          chatModel: anthropicChatModel,
          apiKey: anthropicKey && !anthropicKey.startsWith('****') ? anthropicKey : undefined,
        },
      };
      await updateLlmSettings(body);
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // Save first so the test runs against the just-saved config.
      await save();
      const result = await testLlmConnection();
      setTestResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  /**
   * Save the current form, then query the server(s) for the models they expose.
   * Populates the chat/embed model dropdowns. Uses the selected providers.
   */
  async function refreshModels(which: 'chat' | 'embed') {
    setListing(which);
    setModelsError(null);
    try {
      // Save first so the server URL / provider we just typed is what we query.
      await save();
      const res = await getLlmModels(which);
      if (res.ok) {
        const list = res.models;
        if (which === 'chat') setChatModels(list);
        else setEmbedModels(list);
        // If the list is non-empty and the current model isn't in it, keep the
        // value (free text) but surface the options.
        if (list.length === 0) {
          setModelsError(`Connected to ${res.provider}, but no models were returned.`);
        }
      } else {
        setModelsError(res.message ?? `Could not list models from ${res.provider}.`);
      }
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : 'Failed to list models');
    } finally {
      setListing(null);
    }
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-destructive" />
              Settings Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The AI server settings can only be changed by an admin. Ask a school
              admin to update the LLM server configuration.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <SettingsIcon className="mr-2 inline h-5 w-5 text-primary" />
              {t('nav.settings')}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure the LLM server the app uses for chat and embeddings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <Loader2 className={loading ? 'animate-spin' : ''} />
              Reload
            </Button>
            <Button onClick={save} disabled={saving || loading}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <CloudOff className="h-5 w-5 text-destructive" />
              {error}
            </CardContent>
          </Card>
        )}

        {loading && !settings ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          settings && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Chat + embedding provider selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Providers
                  </CardTitle>
                  <CardDescription>
                    Choose which provider handles chat completions and which
                    handles embeddings. They can differ.
                  </CardDescription>
                </CardHeader>
                <div className="flex items-center justify-between px-6 pt-2">
                  <span className="text-xs text-muted-foreground">
                    Available models on the selected server:
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshModels('chat')}
                      disabled={listing === 'chat' || loading}
                    >
                      {listing === 'chat' ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RefreshCw />
                      )}
                      Chat models
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshModels('embed')}
                      disabled={listing === 'embed' || loading}
                    >
                      {listing === 'embed' ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RefreshCw />
                      )}
                      Embed models
                    </Button>
                  </div>
                </div>
                {modelsError && (
                  <p className="px-6 pt-2 text-xs text-destructive">{modelsError}</p>
                )}
                <CardContent className="space-y-4">
                  <Labeled label="Chat provider" hint="Used for suggestions, resources, and RAG answers.">
                    <select
                      value={chatProvider}
                      onChange={(e) => setChatProvider(e.target.value as LlmProviderName)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label} — {p.hint}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <Labeled label="Embedding provider" hint="Used to embed curriculum chunks and feedback.">
                    <select
                      value={embeddingProvider}
                      onChange={(e) => setEmbeddingProvider(e.target.value as LlmProviderName)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {PROVIDERS.filter((p) => p.value !== 'anthropic').map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label} — {p.hint}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Labeled label="Chat model override" hint="Optional. Leave blank to use the provider default.">
                      <Input
                        value={defaultChatModel}
                        onChange={(e) => setDefaultChatModel(e.target.value)}
                        placeholder="e.g. qwen2.5:7b"
                      />
                    </Labeled>
                    <Labeled label="Embedding model override" hint="Optional.">
                      <Input
                        value={defaultEmbeddingModel}
                        onChange={(e) => setDefaultEmbeddingModel(e.target.value)}
                        placeholder="e.g. nomic-embed-text"
                      />
                    </Labeled>
                  </div>
                </CardContent>
              </Card>

              {/* Ollama server */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Ollama Server
                  </CardTitle>
                  <CardDescription>
                    Local Ollama server address and models.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Labeled
                    label="Server URL"
                    hint='Use http://local-host:11434 to reach Ollama on the machine running the app. For a Tailscale peer, use its 100.x.y.z IP.'
                  >
                    <Input
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://local-host:11434"
                    />
                  </Labeled>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Labeled label="Chat model">
                      <ModelField
                        value={ollamaChatModel}
                        onChange={setOllamaChatModel}
                        listId="ollama-chat-models"
                        options={chatProvider === 'ollama' ? chatModels : []}
                        placeholder="llama3.2:1b"
                      />
                    </Labeled>
                    <Labeled label="Embedding model">
                      <ModelField
                        value={ollamaEmbedModel}
                        onChange={setOllamaEmbedModel}
                        listId="ollama-embed-models"
                        options={embeddingProvider === 'ollama' ? embedModels : []}
                        placeholder="nomic-embed-text"
                      />
                    </Labeled>
                  </div>
                </CardContent>
              </Card>

              {/* OpenAI-compatible server */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    OpenAI-compatible Server
                  </CardTitle>
                  <CardDescription>
                    Any OpenAI-compatible endpoint: LM Studio, llama.cpp, vLLM,
                    Ollama&apos;s /v1, or real OpenAI.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Labeled
                    label="Base URL"
                    hint='e.g. http://local-host:1234/v1 (LM Studio) or http://100.64.0.5:8080/v1 (Tailscale peer).'
                  >
                    <Input
                      value={openaiBaseUrl}
                      onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                      placeholder="http://local-host:1234/v1"
                    />
                  </Labeled>
                  <Labeled
                    label="API key"
                    hint="Local servers accept any non-empty string. Leave blank to clear."
                  >
                    <Input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="lm-studio"
                    />
                  </Labeled>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Labeled label="Chat model">
                      <ModelField
                        value={openaiChatModel}
                        onChange={setOpenaiChatModel}
                        listId="openai-chat-models"
                        options={chatProvider === 'openai' ? chatModels : []}
                        placeholder="llama-3.1-8b"
                      />
                    </Labeled>
                    <Labeled label="Embedding model">
                      <ModelField
                        value={openaiEmbedModel}
                        onChange={setOpenaiEmbedModel}
                        listId="openai-embed-models"
                        options={embeddingProvider === 'openai' ? embedModels : []}
                        placeholder="nomic-embed-text"
                      />
                    </Labeled>
                  </div>
                </CardContent>
              </Card>

              {/* Anthropic server */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Anthropic
                  </CardTitle>
                  <CardDescription>
                    Claude for chat. Embeddings are not supported — keep the
                    embedding provider as Ollama or OpenAI.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Labeled label="Base URL" hint="Defaults to https://api.anthropic.com">
                    <Input
                      value={anthropicBaseUrl}
                      onChange={(e) => setAnthropicBaseUrl(e.target.value)}
                      placeholder="https://api.anthropic.com"
                    />
                  </Labeled>
                  <Labeled label="API key">
                    <Input
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                  </Labeled>
                  <Labeled label="Chat model">
                    <Input
                      value={anthropicChatModel}
                      onChange={(e) => setAnthropicChatModel(e.target.value)}
                      placeholder="claude-sonnet-4-20250514"
                    />
                  </Labeled>
                </CardContent>
              </Card>
            </div>
          )
        )}

        {/* Connection test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              Test Connection
            </CardTitle>
            <CardDescription>
              Saves your settings, then makes a real chat and embedding call to
              verify the server is reachable and the models exist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runTest} disabled={testing || saving || loading}>
              {testing ? <Loader2 className="animate-spin" /> : <Plug />}
              {testing ? 'Testing…' : 'Save & test connection'}
            </Button>

            {testResult && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(['chat', 'embed'] as const).map((cap) => {
                  const r = testResult[cap];
                  return (
                    <div
                      key={cap}
                      className={`rounded-lg border p-3 text-sm ${
                        r.ok
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-destructive/40 bg-destructive/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {r.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        {cap === 'chat' ? 'Chat' : 'Embed'}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.provider} · {r.model || '(default)'}
                      </p>
                      {r.message && (
                        <p className="mt-1 break-words text-xs">{r.message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
