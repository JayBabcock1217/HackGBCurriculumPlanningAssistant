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
  Info,
  Trash2,
  Edit,
} from 'lucide-react';

const feedback = [
  {
    id: '1',
    action: 'rejected',
    suggestion: 'Division Concept - Equal Groups',
    student: 'Sofia Rodriguez',
    reason: 'Too much text, needs visual approach',
    comment:
      'Sofia is still building English proficiency. She needs picture-based instructions and physical manipulatives. Avoid text-heavy materials for her until her reading improves.',
    date: 'Oct 12, 2025',
    edited: false,
  },
  {
    id: '2',
    action: 'modified',
    suggestion: 'Multiplication Tables - Gamified Drill',
    student: 'Liam Chen',
    reason: 'Adjusted difficulty level',
    comment:
      'Changed focus from 2-digit multiplication to 5s and 10s patterns. Liam is ready for extension but needs to solidify these patterns first. The card game format worked well though.',
    date: 'Oct 13, 2025',
    edited: true,
  },
  {
    id: '3',
    action: 'accepted',
    suggestion: 'Word Problems - Visual Story Approach',
    student: 'Emma Davis',
    reason: 'Perfect fit for Emma',
    comment:
      'The visual story frames were exactly what Emma needed. The large dyslexia-friendly fonts helped a lot. Consider adding a matching activity for kinesthetic learning next time.',
    date: 'Oct 14, 2025',
    edited: false,
  },
  {
    id: '4',
    action: 'accepted',
    suggestion: 'Fraction Addition - Scaffolded Lesson',
    student: 'Sofia Rodriguez',
    reason: 'Good scaffolding approach',
    comment:
      'The visual fraction bars and bilingual vocabulary list were great. The hands-on paper activity worked well. Keep this style for Sofia going forward.',
    date: 'Oct 15, 2025',
    edited: false,
  },
  {
    id: '5',
    action: 'modified',
    suggestion: 'Reading Comprehension - Inference Practice',
    student: 'Emma Davis',
    reason: 'Shortened activity length',
    comment:
      'Reduced from 30 min to 15 min. Emma loses focus after about 12-15 minutes of reading tasks. The inference questions were good but too many for one session.',
    date: 'Oct 10, 2025',
    edited: true,
  },
  {
    id: '6',
    action: 'rejected',
    suggestion: 'Multiplication - Timed Drill',
    student: 'Ava Patel',
    reason: 'Not suitable for ADHD',
    comment:
      'Timed drills are stressful for Ava. She performs much better with self-paced activities. Avoid time pressure for her. Try incorporating movement breaks and choice-based activities instead.',
    date: 'Oct 8, 2025',
    edited: false,
  },
];

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

export default function FeedbackPage() {
  const counts = {
    accepted: feedback.filter((f) => f.action === 'accepted').length,
    modified: feedback.filter((f) => f.action === 'modified').length,
    rejected: feedback.filter((f) => f.action === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Teacher Feedback
        </h1>
        <p className="text-sm text-muted-foreground">
          Your feedback guides the AI&apos;s future suggestions. Edit or delete
          any entry at any time.
        </p>
      </div>

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
        {feedback.map((f) => {
          const config = actionConfig[f.action];
          return (
            <Card key={f.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Badge
                      variant={config.variant}
                      className="gap-1"
                    >
                      {config.icon}
                      {config.label}
                    </Badge>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          {f.suggestion}
                        </p>
                        {f.edited && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Edit className="mr-1 h-2.5 w-2.5" />
                            Edited
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {f.student} · {f.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <Separator className="my-3" />

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Reason
                  </p>
                  <p className="text-sm">{f.reason}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Notes
                  </p>
                  <p className="text-sm text-foreground/80">{f.comment}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Box */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/30">
        <CardContent className="flex gap-3 p-5">
          <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
              How feedback guides suggestions
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-200 leading-relaxed">
              Before generating new suggestions, the system searches your past
              feedback for relevant entries and includes them in the AI&apos;s
              context. For example, after you rejected the division lesson for
              Sofia, the AI now knows to prioritize visual and hands-on
              approaches with minimal text for ELL students. Recent feedback
              carries more weight than older entries.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
