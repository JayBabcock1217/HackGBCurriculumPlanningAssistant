'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Lightbulb,
  Check,
  Pencil,
  X,
  Sparkles,
  Clock,
  Loader2,
  CloudOff,
  Trash2,
  FileText,
  BookOpen,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  getSuggestions,
  generateSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
  createFeedback,
  getStudents,
  getCurricula,
  type Student,
  type Curriculum,
  type Suggestion,
} from '@/lib/api';

const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'secondary'> = {
  pending: 'warning',
  accepted: 'success',
  modified: 'info',
  rejected: 'destructive',
  archived: 'secondary',
};

const typeLabel: Record<string, string> = {
  lesson_plan: 'Lesson Plan',
  activity: 'Activity',
  assessment: 'Assessment',
  intervention: 'Intervention',
  resource: 'Resource',
};

const typeIcons: Record<string, string> = {
  lesson_plan: '📋',
  activity: '🎯',
  assessment: '📝',
  intervention: '🔧',
  resource: '📦',
};

function studentInfo(s: Student) {
  const bits: string[] = [];
  if (s.gradeLevel) bits.push(`${s.gradeLevel} Grade`);
  if (s.readingLevel != null) bits.push(`Reading ${s.readingLevel}`);
  if (s.mathAbility != null) bits.push(`Math ${s.mathAbility}`);
  if (s.ellStatus) bits.push(`ELL (${s.ellStatus.homeLanguage})`);
  if (s.iepDetails) bits.push(s.iepDetails.planType);
  return bits.join(' · ') || 'No profile details';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SuggestionDetails {
  summary?: string;
  focus?: string;
  generationId?: string;
  sources?: Array<{ chunkId: string; similarity: number }>;
}

// Group flat suggestion rows into "option sets": rows sharing a generationId
// (same student + curriculum + generation) collapse into one card showing N
// distinct options. Legacy rows without a generationId become single-option sets.
function groupIntoSets(suggestions: Suggestion[]): Suggestion[][] {
  const sets: Suggestion[][] = [];
  const index = new Map<string, number>();
  for (const s of suggestions) {
    const d = (s.details as SuggestionDetails | undefined) || {};
    const key = d.generationId || s.id;
    if (!index.has(key)) {
      index.set(key, sets.length);
      sets.push([]);
    }
    sets[index.get(key)!].push(s);
  }
  // Each set is internally sorted by createdAt so options appear in order.
  for (const set of sets) {
    set.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return sets;
}

function OptionRow({
  option,
  index,
  onAccept,
  onModify,
  onReject,
  onView,
  onDelete,
}: {
  option: Suggestion;
  index: number;
  onAccept: () => void;
  onModify: () => void;
  onReject: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const d = (option.details as SuggestionDetails | undefined) || {};
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcons[option.type] || '💡'}</span>
            <span className="font-medium">{option.title || typeLabel[option.type] || option.type}</span>
            <Badge variant="secondary" className="text-[10px]">
              Option {index + 1}
            </Badge>
          </div>
          {d.summary && (
            <p className="mt-1.5 text-sm text-foreground/70">{d.summary}</p>
          )}
          <div className="mt-2 whitespace-pre-line rounded-md bg-muted/40 p-3 text-sm leading-relaxed text-foreground/80">
            {option.content}
          </div>
          {option.feedback && (
            <div className="mt-2 rounded-lg border-l-4 border-blue-300 bg-blue-50/50 p-3 dark:border-blue-700 dark:bg-blue-950/30">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
                Teacher Feedback ({option.feedback.action})
              </p>
              {option.feedback.reason && (
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <span className="font-medium">Reason:</span> {option.feedback.reason}
                </p>
              )}
              {option.feedback.teacherComment && (
                <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
                  {option.feedback.teacherComment}
                </p>
              )}
            </div>
          )}
        </div>
        <Badge
          variant={statusVariant[option.status] || 'secondary'}
          className="shrink-0 capitalize"
        >
          {option.status}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {option.status === 'pending' ? (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              onClick={onAccept}
            >
              <Check /> Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={onModify}>
              <Pencil /> Modify
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject}>
              <X /> Reject
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={onView}>
            View / Edit Feedback
          </Button>
        )}
        <div className="ml-auto">
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generation form
  const [genStudent, setGenStudent] = useState('');
  const [genCurriculum, setGenCurriculum] = useState('');
  const [genFocus, setGenFocus] = useState('');
  const [genCount, setGenCount] = useState(3);
  const [genLanguage, setGenLanguage] = useState('');
  const [generating, setGenerating] = useState(false);

  // Feedback dialog state
  const [fbTarget, setFbTarget] = useState<Suggestion | null>(null);
  const [fbAction, setFbAction] = useState<'accepted' | 'modified' | 'rejected'>('accepted');
  const [fbReason, setFbReason] = useState('');
  const [fbComment, setFbComment] = useState('');
  const [fbModifiedContent, setFbModifiedContent] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [savingFb, setSavingFb] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [sg, st, cu] = await Promise.all([
        getSuggestions(),
        getStudents(),
        getCurricula(),
      ]);
      setSuggestions(sg);
      setStudents(st);
      setCurricula(cu);
      // Derive a teacher id from the first student's teacher
      if (st.length > 0 && st[0].teacher) setTeacherId(st[0].teacher.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genStudent || !genCurriculum) return;
    setGenerating(true);
    setError(null);
    try {
      await generateSuggestions({
        studentId: genStudent,
        curriculumId: genCurriculum,
        optionCount: genCount,
        focus: genFocus || undefined,
        language: genLanguage || undefined,
      });
      setGenFocus('');
      setGenLanguage('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleQuickStatus(s: Suggestion, status: Suggestion['status']) {
    try {
      await updateSuggestionStatus(s.id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function openFeedback(s: Suggestion, action: 'accepted' | 'modified' | 'rejected') {
    setFbTarget(s);
    setFbAction(action);
    setFbReason('');
    setFbComment('');
    setFbModifiedContent(action === 'modified' ? s.content : '');
  }

  async function handleSaveFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!fbTarget || !teacherId) return;
    setSavingFb(true);
    try {
      await createFeedback({
        action: fbAction,
        reason: fbReason || undefined,
        teacherComment: fbComment || undefined,
        modifiedContent: fbModifiedContent || undefined,
        suggestionId: fbTarget.id,
        teacherId,
      });
      await updateSuggestionStatus(fbTarget.id, fbAction);
      setFbTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save feedback');
    } finally {
      setSavingFb(false);
    }
  }

  async function handleDelete(s: Suggestion) {
    if (!confirm('Delete this suggestion?')) return;
    try {
      await deleteSuggestion(s.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <AppShell>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suggestions</h1>
          <p className="text-sm text-muted-foreground">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} ·{' '}
            {pendingCount} pending review
          </p>
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

      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate Personalized Suggestions
          </CardTitle>
          <CardDescription>
            Pick a student and a curriculum. The AI retrieves relevant content and generates
            distinct lesson options tailored to the student&apos;s profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 || curricula.length === 0 ? (
            <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              You need at least one student and one indexed curriculum to generate
              suggestions. Add them from the{' '}
              <a href="/students" className="text-primary underline">
                Students
              </a>{' '}
              and{' '}
              <a href="/curricula" className="text-primary underline">
                Curricula
              </a>{' '}
              pages first.
            </p>
          ) : (
            <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Users className="h-3 w-3" /> Student
                </label>
                <select
                  value={genStudent}
                  onChange={(e) => setGenStudent(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
                  required
                >
                  <option value="">Select student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <BookOpen className="h-3 w-3" /> Curriculum
                </label>
                <select
                  value={genCurriculum}
                  onChange={(e) => setGenCurriculum(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
                  required
                >
                  <option value="">Select curriculum…</option>
                  {curricula.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Focus (optional)</label>
                <Input
                  value={genFocus}
                  onChange={(e) => setGenFocus(e.target.value)}
                  placeholder="e.g. regrouping"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground"># options</label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Content language
                </label>
                <select
                  value={genLanguage}
                  onChange={(e) => setGenLanguage(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
                >
                  <option value="">Match curriculum</option>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Mandarin">Mandarin</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={generating || !genStudent || !genCurriculum}>
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" /> Generating… (may take ~30s)
                    </>
                  ) : (
                    <>
                      <Sparkles /> Generate
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No suggestions yet</p>
              <p className="text-sm text-muted-foreground">
                Generate your first personalized lesson plan above.
              </p>
            </CardContent>
          </Card>
        ) : (
          groupIntoSets(suggestions).map((set) => {
            const first = set[0];
            const d = (first.details as SuggestionDetails | undefined) || {};
            const studentName = first.student
              ? `${first.student.firstName} ${first.student.lastName}`
              : 'Unknown student';
            const student = students.find((st) => st.id === first.student?.id);
            const pendingInSet = set.filter((o) => o.status === 'pending').length;
            return (
              <Card key={d.generationId || first.id}>
                {/* Set header */}
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>
                      {studentName}
                      {student && ` · ${studentInfo(student)}`}
                    </CardDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {set.length} option{set.length !== 1 ? 's' : ''}
                      </Badge>
                      {d.sources && d.sources.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {d.sources.length} source(s)
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {first.modelUsed || 'model'} · {formatDate(first.createdAt)}
                      </span>
                      {d.focus && <span>· focus: {d.focus}</span>}
                    </div>
                  </div>
                  <Badge
                    variant={pendingInSet > 0 ? 'warning' : 'success'}
                    className="capitalize"
                  >
                    {pendingInSet > 0 ? `${pendingInSet} pending` : 'reviewed'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {set.map((opt, i) => (
                    <OptionRow
                      key={opt.id}
                      option={opt}
                      index={i}
                      onAccept={() => openFeedback(opt, 'accepted')}
                      onModify={() => openFeedback(opt, 'modified')}
                      onReject={() => openFeedback(opt, 'rejected')}
                      onView={() => openFeedback(opt, opt.status === 'rejected' ? 'rejected' : opt.status === 'modified' ? 'modified' : 'accepted')}
                      onDelete={() => handleDelete(opt)}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Feedback dialog */}
      {fbTarget && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {fbAction === 'accepted'
                    ? 'Accept Suggestion'
                    : fbAction === 'modified'
                      ? 'Modify Suggestion'
                      : 'Reject Suggestion'}
                </CardTitle>
                <CardDescription>
                  {fbTarget.title || typeLabel[fbTarget.type]} · {fbTarget.student?.firstName}{' '}
                  {fbTarget.student?.lastName}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFbTarget(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveFeedback} className="space-y-4">
                <Separator />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Reason (optional)
                  </label>
                  <Input
                    value={fbReason}
                    onChange={(e) => setFbReason(e.target.value)}
                    placeholder="e.g. Too much text for this student"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Teacher comment (optional)
                  </label>
                  <textarea
                    value={fbComment}
                    onChange={(e) => setFbComment(e.target.value)}
                    rows={3}
                    placeholder="Why this approach works or doesn't for this student…"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                {fbAction === 'modified' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Modified content
                    </label>
                    <textarea
                      value={fbModifiedContent}
                      onChange={(e) => setFbModifiedContent(e.target.value)}
                      rows={8}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFbTarget(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingFb}>
                    {savingFb && <Loader2 className="animate-spin" />}
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </AppShell>
  );
}
