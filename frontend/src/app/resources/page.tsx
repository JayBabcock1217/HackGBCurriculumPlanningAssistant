'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  FileInput,
  Sparkles,
  Loader2,
  CloudOff,
  Download,
  Users,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import {
  generateSuggestions,
  getStudents,
  getCurricula,
  type Student,
  type Curriculum,
} from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';

type ResourceKind = 'worksheet' | 'reading' | 'practice';

const KIND_FOCUS: Record<ResourceKind, string> = {
  worksheet:
    'a printable worksheet of targeted practice problems with an answer key',
  reading: 'a short leveled reading passage followed by comprehension questions',
  practice: 'a set of graded practice problems progressing from easy to hard',
};

interface GeneratedResource {
  title: string;
  type: string;
  summary: string;
  content: string;
}

/**
 * Resources page (Chunk 12)
 *
 * Teacher-initiated, slow generation path. Resources are never generated
 * automatically — the teacher picks a student + type and triggers it. A
 * progress indicator animates while the LLM works (the call can take ~60s on
 * a small local model).
 */
export default function ResourcesPage() {
  const { t } = useI18n();
  const [students, setStudents] = useState<Student[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [studentId, setStudentId] = useState('');
  const [curriculumId, setCurriculumId] = useState('');
  const [kind, setKind] = useState<ResourceKind>('worksheet');
  const [focus, setFocus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResource | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([getStudents(), getCurricula()]);
      setStudents(s);
      setCurricula(c);
      if (s.length > 0) setStudentId(s[0].id);
      if (c.length > 0) setCurriculumId(c[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  // While generating, advance the progress bar and a live elapsed-seconds
  // counter so the teacher can see it is working (not frozen).
  useEffect(() => {
    if (!generating) return;
    setProgress(0);
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      // Ease toward 95% asymptotically; the final jump to 100 happens on
      // success.
      setProgress((p) => Math.min(95, p + Math.max(0.5, (95 - p) * 0.03)));
    }, 300);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generating]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !curriculumId) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateSuggestions({
        studentId,
        curriculumId,
        optionCount: 1,
        // Chunk 12: steer the generator toward a single, specific resource type.
        focus: `${KIND_FOCUS[kind]}${focus ? ` — focus: ${focus}` : ''}`,
      });
      // Take the first (only) option as the resource.
      if (res.options.length > 0) {
        setResult(res.options[0]);
        setProgress(100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(result.title || 'resource').replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const kindLabel =
    kind === 'worksheet'
      ? t('resources.worksheet')
      : kind === 'reading'
        ? t('resources.reading')
        : t('resources.practice');

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('resources.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('resources.subtitle')}</p>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <CloudOff className="h-5 w-5 text-destructive" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Trigger form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('resources.generate')}
            </CardTitle>
            <CardDescription>
              {t('resources.pickStudent')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                {t('resources.noStudent')}
              </p>
            ) : (
              <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Users className="h-3 w-3" /> {t('suggestions.student')}
                  </label>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    required
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <BookOpen className="h-3 w-3" /> {t('suggestions.curriculum')}
                  </label>
                  <select
                    value={curriculumId}
                    onChange={(e) => setCurriculumId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    required
                  >
                    <option value="">—</option>
                    {curricula.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('resources.type')}
                  </label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as ResourceKind)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="worksheet">{t('resources.worksheet')}</option>
                    <option value="reading">{t('resources.reading')}</option>
                    <option value="practice">{t('resources.practice')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('resources.focus')}
                  </label>
                  <Input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder={t('resources.focusPlaceholder')}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button
                    type="submit"
                    disabled={generating || !studentId || !curriculumId}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="animate-spin" />
                        {t('resources.generating')}
                      </>
                    ) : (
                      <>
                        <FileInput /> {t('resources.generate')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Progress indicator during generation */}
        {generating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {t('resources.generating')}
              </CardTitle>
              <CardDescription>
                {kindLabel} · {elapsed}s
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} />
              <p className="mt-2 text-xs text-muted-foreground">
                {Math.round(progress)}%
              </p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && !generating && (
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileInput className="h-4 w-4 text-primary" />
                  {t('resources.resultTitle')}
                </CardTitle>
                <CardDescription>
                  {result.title || kindLabel}
                  {result.summary && ` — ${result.summary}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={download}>
                  <Download /> {t('resources.download')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    setFocus('');
                  }}
                >
                  <RefreshCw /> {t('resources.newResource')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line rounded-md bg-muted/40 p-4 text-sm leading-relaxed text-foreground/80">
                {result.content}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
