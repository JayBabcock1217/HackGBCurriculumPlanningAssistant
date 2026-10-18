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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Check,
  Pencil,
  X,
  Trash2,
  Loader2,
  CloudOff,
  MessageSquare,
} from 'lucide-react';
import {
  getFeedback,
  deleteFeedback,
  type Feedback,
} from '@/lib/api';

const actionConfig: Record<
  string,
  { variant: 'success' | 'info' | 'destructive'; icon: React.ReactNode; label: string }
> = {
  accepted: {
    variant: 'success',
    icon: <Check className="h-3 w-3" />,
    label: 'Accepted',
  },
  modified: {
    variant: 'info',
    icon: <Pencil className="h-3 w-3" />,
    label: 'Modified',
  },
  rejected: {
    variant: 'destructive',
    icon: <X className="h-3 w-3" />,
    label: 'Rejected',
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const f = await getFeedback();
      // Newest first
      f.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFeedback(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(f: Feedback) {
    if (!confirm('Delete this feedback entry?')) return;
    try {
      await deleteFeedback(f.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const counts = {
    accepted: feedback.filter((f) => f.action === 'accepted').length,
    modified: feedback.filter((f) => f.action === 'modified').length,
    rejected: feedback.filter((f) => f.action === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Your feedback is stored and guides the AI&apos;s future suggestions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <MessageSquare />}
          Refresh
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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/60">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {counts.accepted}
              </p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/60">
              <Pencil className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {counts.modified}
              </p>
              <p className="text-xs text-muted-foreground">Modified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60">
              <X className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {counts.rejected}
              </p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Timeline */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : feedback.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No feedback yet</p>
              <p className="text-sm text-muted-foreground">
                Accept, modify, or reject a suggestion to record feedback here.
              </p>
            </CardContent>
          </Card>
        ) : (
          feedback.map((f) => {
            const config = actionConfig[f.action] || actionConfig.accepted;
            const studentName = f.suggestion?.student
              ? `${f.suggestion.student.firstName} ${f.suggestion.student.lastName}`
              : 'Unknown student';
            return (
              <Card key={f.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant}>
                          {config.icon}
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(f.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 font-medium">
                        {f.suggestion?.title || 'Untitled suggestion'}
                      </p>
                      <p className="text-sm text-muted-foreground">{studentName}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(f)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {f.reason && (
                    <p className="mt-3 text-sm">
                      <span className="font-medium text-muted-foreground">Reason:</span>{' '}
                      {f.reason}
                    </p>
                  )}
                  {f.teacherComment && (
                    <div className="mt-2">
                      <Separator />
                      <p className="mt-2 text-sm text-foreground/80">{f.teacherComment}</p>
                    </div>
                  )}
                  {f.modifiedContent && (
                    <div className="mt-2 rounded-md bg-muted/40 p-3">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        Modified version
                      </p>
                      <p className="whitespace-pre-line text-sm text-foreground/80">
                        {f.modifiedContent}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
