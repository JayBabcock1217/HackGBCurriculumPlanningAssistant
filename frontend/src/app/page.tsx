'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  BookOpen,
  Lightbulb,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  CloudOff,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  getStudents,
  getCurricula,
  getSuggestions,
  getFeedback,
  type Student,
  type Curriculum,
  type Suggestion,
  type Feedback,
} from '@/lib/api';

const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'destructive'> = {
  pending: 'warning',
  accepted: 'success',
  modified: 'info',
  rejected: 'destructive',
};

const flagVariant: Record<string, 'purple' | 'teal' | 'amber'> = {
  IEP: 'purple',
  ELL: 'teal',
  '504': 'amber',
};

function flagsForStudent(s: Student): string[] {
  const flags: string[] = [];
  if (s.iepDetails) flags.push(s.iepDetails.planType);
  if (s.ellStatus) flags.push('ELL');
  return flags;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function DashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, c, sg, fb] = await Promise.all([
        getStudents(),
        getCurricula(),
        getSuggestions(),
        getFeedback(),
      ]);
      setStudents(s);
      setCurricula(c);
      setSuggestions(sg);
      setFeedback(fb);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const totalChunks = curricula.reduce((sum, c) => sum + (c.chunkCount || 0), 0);
  const acceptanceRate =
    feedback.length > 0
      ? Math.round(
          (feedback.filter((f) => f.action === 'accepted').length /
            feedback.length) *
            100,
        )
      : null;

  // Aggregate skill mastery from all progress entries across students
  const bySkill: Record<string, { total: number; count: number }> = {};
  for (const s of students) {
    for (const p of s.progressEntries || []) {
      const key = p.skillName || p.skillArea;
      const max = p.maxScore || 100;
      const pct = Math.min(100, Math.round((p.score / max) * 100));
      bySkill[key] = bySkill[key] || { total: 0, count: 0 };
      bySkill[key].total += pct;
      bySkill[key].count += 1;
    }
  }
  const skillMastery = Object.entries(bySkill)
    .map(([skill, v]) => ({ skill, value: Math.round(v.total / v.count) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const recentStudents = students.slice(0, 5);
  const recentSuggestions = suggestions.slice(0, 4);

  const stats = [
    { label: 'Students', value: String(students.length), change: 'in class', icon: Users },
    { label: 'Curricula', value: String(curricula.length), change: `${totalChunks} chunks indexed`, icon: BookOpen },
    { label: 'Pending Suggestions', value: String(pendingCount), change: `${suggestions.length} total`, icon: Lightbulb },
    { label: 'Feedback Entries', value: String(feedback.length), change: acceptanceRate === null ? 'no feedback yet' : `${acceptanceRate}% acceptance`, icon: MessageSquare },
  ];

  return (
    <AppShell>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            An overview of your class and AI-generated plans.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/suggestions">
              <Lightbulb />
              Review Suggestions
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <CloudOff className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Backend unavailable</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[11px] text-muted-foreground/70">{stat.change}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Students */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>
                {recentStudents.length} of {students.length} shown
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/students">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentStudents.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No students yet. Add one from the Students page.
              </p>
            ) : (
              recentStudents.map((student) => {
                const name = `${student.firstName} ${student.lastName}`;
                const flags = flagsForStudent(student);
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="text-xs font-bold">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.readingLevel != null
                            ? `Reading ${student.readingLevel}`
                            : 'Reading —'}
                          {' · '}
                          {student.mathAbility != null
                            ? `Math ${student.mathAbility}`
                            : 'Math —'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {flags.map((flag) => (
                        <Badge
                          key={flag}
                          variant={flagVariant[flag] || 'secondary'}
                          className="text-[10px]"
                        >
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Suggestions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Suggestions</CardTitle>
              <CardDescription>Latest AI-generated plans</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/suggestions">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSuggestions.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No suggestions yet. Generate one from the Suggestions page.
              </p>
            ) : (
              recentSuggestions.map((s) => {
                const studentName = s.student
                  ? `${s.student.firstName} ${s.student.lastName}`
                  : 'Unknown student';
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.title || s.type.replace('_', ' ')}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {studentName} · {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <Badge variant={statusVariant[s.status] || 'secondary'} className="ml-2 capitalize">
                      {s.status}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skill Mastery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Class Skill Mastery
          </CardTitle>
          <CardDescription>
            Average progress-entry performance across all students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {skillMastery.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No progress data yet. Add progress entries for a student to see mastery here.
            </p>
          ) : (
            skillMastery.map((item) => (
              <div key={item.skill} className="flex items-center gap-4">
                <span className="w-28 truncate text-sm text-muted-foreground">
                  {item.skill}
                </span>
                <Progress value={item.value} className="flex-1" />
                <span className="w-10 text-right text-sm font-medium">
                  {item.value}%
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
