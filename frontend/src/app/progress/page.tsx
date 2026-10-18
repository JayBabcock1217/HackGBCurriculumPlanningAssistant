'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  CloudOff,
  Loader2,
  Users,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import {
  getTeachers,
  getStudentTimeline,
  getClassTimeline,
  type ClassTimeline,
  type StudentTimeline,
  type EntryRow,
} from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';

const AREA_LABEL: Record<string, string> = {
  reading: 'Reading',
  math: 'Math',
  writing: 'Writing',
  science: 'Science',
  social_studies: 'Social Studies',
  other: 'Other',
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A line chart of average percent over time (class or a single student). */
function OverTimeChart({
  data,
  height = 220,
}: {
  data: Array<{ date: string; percent: number; entries: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => shortDate(`${d}T00:00:00Z`)}
          tick={{ fontSize: 11 }}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
        <Tooltip
          formatter={(v) => [`${v}%`, 'average']}
          labelFormatter={(d) => shortDate(`${String(d)}T00:00:00Z`)}
        />
        <Line
          type="monotone"
          dataKey="percent"
          stroke="var(--chart-1, #6366f1)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** A horizontal bar list of per-skill mastery (percent per skill). */
function SkillMasteryList({
  items,
  showArea,
}: {
  items: Array<{ skill: string; percent: number; entries: number; skillArea?: string }>;
  showArea?: boolean;
}) {
  const { t } = useI18n();
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t('progress.noData')}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.skill} className="flex items-center gap-3">
          <span className="w-32 truncate text-sm text-muted-foreground">
            {item.skill}
            {showArea && item.skillArea && (
              <span className="ml-1 text-xs text-muted-foreground/60">
                ({AREA_LABEL[item.skillArea] || item.skillArea})
              </span>
            )}
          </span>
          <Progress value={item.percent} className="flex-1" />
          <span className="w-10 text-right text-sm font-medium">{item.percent}%</span>
          <span className="w-16 text-right text-[11px] text-muted-foreground/60">
            {item.entries} {t('progress.entries')}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The per-student view: mastery chart + full timeline list. */
function StudentView({ timeline }: { timeline: StudentTimeline }) {
  const { t } = useI18n();
  const { student, entries, skillAverages } = timeline;

  const overTime = useMemo(() => {
    // Average percent per calendar day for this student
    const dayMap = new Map<string, { total: number; count: number }>();
    for (const e of entries) {
      const day = e.createdAt.slice(0, 10);
      const cur = dayMap.get(day) || { total: 0, count: 0 };
      cur.total += e.percent;
      cur.count += 1;
      dayMap.set(day, cur);
    }
    return Array.from(dayMap.entries())
      .map(([date, v]) => ({
        date,
        percent: Math.round(v.total / v.count),
        entries: v.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t('progress.studentMastery')}
            </CardTitle>
            <CardDescription>{t('progress.studentMasteryDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <SkillMasteryList items={skillAverages} showArea />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('progress.overTime')}
            </CardTitle>
            <CardDescription>{t('progress.overTimeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {overTime.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('progress.noData')}
              </p>
            ) : (
              <OverTimeChart data={overTime} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('progress.timeline')}</CardTitle>
          <CardDescription>
            {t('progress.timelineDesc')} — {student.firstName} {student.lastName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('progress.noData')}
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-auto pr-1">
              {entries.map((e: EntryRow) => (
                <div key={e.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{e.skillName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {AREA_LABEL[e.skillArea] || e.skillArea}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {shortDate(e.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={e.percent} className="h-1.5 flex-1" />
                    <span className="text-xs font-medium">
                      {e.score}/{e.maxScore} ({e.percent}%)
                    </span>
                  </div>
                  {e.notes && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{e.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProgressPage() {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<Array<{ id: string }>>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [students, setStudents] = useState<ClassTimeline['students']>([]);
  const [classTimeline, setClassTimeline] = useState<ClassTimeline | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentTimeline, setStudentTimeline] = useState<StudentTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const ts = await getTeachers();
      setTeachers(ts);
      if (ts.length > 0) {
        const tid = ts[0].id;
        setTeacherId(tid);
        const ct = await getClassTimeline(tid);
        setClassTimeline(ct);
        setStudents(ct.students);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openStudent(id: string) {
    setLoadingStudent(true);
    setError(null);
    try {
      const st = await getStudentTimeline(id);
      setStudentId(id);
      setStudentTimeline(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load student timeline');
    } finally {
      setLoadingStudent(false);
    }
  }

  function backToClass() {
    setStudentId(null);
    setStudentTimeline(null);
  }

  const studentsWithData = students.filter((s) => s.entryCount > 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('progress.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('progress.subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            {t('dashboard.refresh')}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <CloudOff className="h-5 w-5 text-destructive" />
              {error}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : studentId && studentTimeline ? (
          <StudentView timeline={studentTimeline} />
        ) : (
          <div className="space-y-6">
            {/* Class over-time chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {t('progress.overTime')}
                </CardTitle>
                <CardDescription>{t('progress.overTimeDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {classTimeline && classTimeline.overTime.length > 0 ? (
                  <OverTimeChart data={classTimeline.overTime} height={240} />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('progress.noData')}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Class skill mastery */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {t('progress.classMastery')}
                  </CardTitle>
                  <CardDescription>{t('progress.classMasteryDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SkillMasteryList
                    items={classTimeline?.skillAverages || []}
                  />
                </CardContent>
              </Card>

              {/* Student roster */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {t('nav.students')}
                  </CardTitle>
                  <CardDescription>
                    {studentsWithData.length} {t('progress.studentsTracked')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t('progress.noStudents')}
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-auto pr-1">
                      {students.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => openStudent(s.id)}
                          className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {s.firstName} {s.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.entryCount} {t('progress.entries')}
                              {s.latest && ` · ${t('progress.latest')} ${AREA_LABEL[s.latest.skillArea] || s.latest.skillArea}`}
                            </p>
                          </div>
                          {s.latestPercent != null ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={s.latestPercent}
                                className="h-1.5 w-20"
                              />
                              <span className="w-9 text-right text-xs font-medium">
                                {s.latestPercent}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {studentId && studentTimeline && (
          <Button variant="ghost" size="sm" onClick={backToClass}>
            <ArrowLeft /> {t('progress.classView')}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
