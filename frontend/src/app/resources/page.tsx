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
  X,
} from 'lucide-react';
import {
  startResourceGeneration,
  getResourceJobStatus,
  getStudents,
  getCurricula,
  type Student,
  type Curriculum,
  type ResourceJobStatus,
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

/** localStorage key for the in-flight job. Survives page navigation and reloads. */
const JOB_KEY = 'hackgb-resource-job';

interface StoredJob {
  jobId: string;
  startedAt: number;
  kind: ResourceKind;
  focus: string;
}

function loadStoredJob(): StoredJob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(JOB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.jobId === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveStoredJob(job: StoredJob): void {
  try {
    localStorage.setItem(JOB_KEY, JSON.stringify(job));
  } catch {
    // ignore
  }
}

function clearStoredJob(): void {
  try {
    localStorage.removeItem(JOB_KEY);
  } catch {
    // ignore
  }
}

/**
 * Resources page (Chunk 12)
 *
 * Teacher-initiated, slow generation path. Resources are never generated
 * automatically — the teacher picks a student + type and triggers it.
 *
 * Persistence: the generation is a BACKGROUND job on the server (it returns a
 * jobId immediately and keeps running after the HTTP request ends). The jobId
 * is stored in localStorage, so if the teacher navigates to another page and
 * comes back — or even reloads the browser — the page re-attaches to the job,
 * resumes the progress indicator from the original start time, and shows the
 * finished resource as soon as it is ready.
 */
export default function ResourcesPage() {
  const { t } = useI18n();
  const [students, setStudents] = useState<Student[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [studentId, setStudentId] = useState('');
  const [curriculumId, setCurriculumId] = useState('');
  const [kind, setKind] = useState<ResourceKind>('worksheet');
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(true);

  // Background job state.
  const [job, setJob] = useState<StoredJob | null>(null);
  const [jobStatus, setJobStatus] = useState<ResourceJobStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResourceJobStatus['options'][number] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // On mount: load students/curricula and re-attach to any in-flight job.
  useEffect(() => {
    load();
    const stored = loadStoredJob();
    if (stored) {
      setJob(stored);
      setFocus(stored.focus);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [load]);

  // While a job is in flight, animate the progress bar (from the original
  // start time so it stays accurate across navigation) and poll the server
  // for the job's status.
  useEffect(() => {
    if (!job) return;
    const jobId = job.jobId;

    // Progress + elapsed are pure functions of the stored start time, so they
    // are identical whether the component mounted for the first time or
    // re-attached after navigation — the bar never resets to 0 on return.
    // Ease toward 95% asymptotically; the final jump to 100 happens on success.
    const start = job.startedAt;
    const compute = () => {
      const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsed(secs);
      setProgress(Math.min(95, 95 * (1 - Math.exp(-secs / 25))));
    };
    compute();
    tickRef.current = setInterval(compute, 300);

    // Poll the server every 2s for the job outcome.
    let cancelled = false;
    async function poll() {
      try {
        const status = await getResourceJobStatus(jobId);
        if (cancelled) return;
        setJobStatus(status);
        if (status.status === 'pending' && status.options.length > 0) {
          setResult(status.options[0]);
          setProgress(100);
          clearStoredJob();
          setJob(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
        } else if (status.status === 'failed') {
          setError(status.error || t('resources.failedTitle'));
          clearStoredJob();
          setJob(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
        }
      } catch (e) {
        // Transient network error: keep polling; surface a soft message.
        if (!cancelled) setError(e instanceof Error ? e.message : 'Connection problem');
      }
    }
    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [job, t]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !curriculumId) return;
    setError(null);
    setResult(null);
    try {
      const { jobId } = await startResourceGeneration({
        studentId,
        curriculumId,
        optionCount: 1,
        // Chunk 12: steer the generator toward a single, specific resource type.
        focus: `${KIND_FOCUS[kind]}${focus ? ` — focus: ${focus}` : ''}`,
        kind,
      });
      const storedJob: StoredJob = {
        jobId,
        startedAt: Date.now(),
        kind,
        focus,
      };
      saveStoredJob(storedJob);
      setJob(storedJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
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

  function discardJob() {
    clearStoredJob();
    setJob(null);
    setJobStatus(null);
    setResult(null);
    setError(null);
    setFocus('');
  }

  const kindLabel =
    kind === 'worksheet'
      ? t('resources.worksheet')
      : kind === 'reading'
        ? t('resources.reading')
        : t('resources.practice');

  // Show the in-progress card when a job is in flight and not yet finished.
  const inProgress = !!job && !result;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('resources.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('resources.subtitle')}</p>
        </div>

        {error && !inProgress && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <CloudOff className="h-5 w-5 text-destructive" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* In-progress indicator (persists across navigation) */}
        {inProgress && (
          <Card className="border-primary/40">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t('resources.inProgressTitle')}
                </CardTitle>
                <CardDescription>
                  {t('resources.inProgressDesc')}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={discardJob} aria-label="Cancel">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <Progress value={progress} />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress)}%</span>
                <span>
                  {kindLabel} · {elapsed}s
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('resources.viewWhenReady')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Trigger form (hidden while a job is in flight) */}
        {!inProgress && (
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
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
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
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
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
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
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
                      disabled={!studentId || !curriculumId}
                    >
                      <FileInput /> {t('resources.generate')}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && !inProgress && (
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
                  onClick={discardJob}
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
