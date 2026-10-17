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
import {
  Lightbulb,
  Check,
  Pencil,
  X,
  Sparkles,
  Clock,
} from 'lucide-react';

const suggestions = [
  {
    id: '1',
    title: 'Fraction Addition - Scaffolded Lesson',
    student: 'Sofia Rodriguez',
    studentInfo: 'Reading 2.9 · Math 2.5 · ELL (Spanish)',
    type: 'Lesson Plan',
    status: 'pending',
    model: 'Ollama / Llama 3',
    date: 'Oct 15, 2025',
    options: 3,
    summary:
      'A 30-minute scaffolded lesson introducing fraction addition using visual fraction bars. Includes a bilingual vocabulary list (Spanish/English) and a hands-on activity with paper fraction strips. Aligned to curriculum Unit 2 objectives.',
    feedback: null,
  },
  {
    id: '2',
    title: 'Word Problems - Visual Story Approach',
    student: 'Emma Davis',
    studentInfo: 'Reading 3.2 · Math 2.8 · IEP (Dyslexia)',
    type: 'Activity',
    status: 'accepted',
    model: 'Ollama / Llama 3',
    date: 'Oct 14, 2025',
    options: 2,
    summary:
      'A 20-minute activity using visual story frames to help students break down word problems. Includes a step-by-step graphic organizer with large, dyslexia-friendly fonts. Three practice problems with visual supports.',
    feedback:
      'Great approach! The visual story frames work well for Emma. Consider adding a matching activity for kinesthetic learning.',
  },
  {
    id: '3',
    title: 'Multiplication Tables - Gamified Drill',
    student: 'Liam Chen',
    studentInfo: 'Reading 3.5 · Math 3.1',
    type: 'Assessment',
    status: 'modified',
    model: 'Ollama / Llama 3',
    date: 'Oct 13, 2025',
    options: 4,
    summary:
      'A 15-minute gamified multiplication drill using a card game format. Originally designed for 2-digit x 1-digit, but modified to focus on 5s and 10s patterns since Liam is stronger in that area.',
    feedback:
      'Modified to focus on 5s and 10s patterns instead of 2-digit multiplication. Liam is ready for extension work but needs to solidify these patterns first.',
  },
  {
    id: '4',
    title: 'Division Concept - Equal Groups',
    student: 'Sofia Rodriguez',
    studentInfo: 'Reading 2.9 · Math 2.5 · ELL (Spanish)',
    type: 'Intervention',
    status: 'rejected',
    model: 'Ollama / Llama 3',
    date: 'Oct 12, 2025',
    options: 2,
    summary:
      'A 45-minute intervention lesson on division using equal groups with manipulatives. Uses a lot of text-based instructions with minimal visual supports.',
    feedback:
      'Rejected because too much text for Sofia. She needs more visual and hands-on approaches with less written instruction. Try using picture-based instructions and physical manipulatives only.',
  },
];

const statusVariant: Record<
  string,
  'success' | 'warning' | 'info' | 'destructive'
> = {
  pending: 'warning',
  accepted: 'success',
  modified: 'info',
  rejected: 'destructive',
};

const typeIcons: Record<string, string> = {
  'Lesson Plan': '📋',
  Activity: '🎯',
  Assessment: '📝',
  Intervention: '🔧',
  Resource: '📦',
};

export default function SuggestionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suggestions</h1>
          <p className="text-sm text-muted-foreground">
            4 suggestions · 1 pending review
          </p>
        </div>
        <Button>
          <Sparkles />
          Generate New Suggestions
        </Button>
      </div>

      <div className="space-y-4">
        {suggestions.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{typeIcons[s.type]}</span>
                <div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {s.student} · {s.studentInfo}
                  </CardDescription>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {s.model} · {s.date} · {s.options} options
                  </div>
                </div>
              </div>
              <Badge variant={statusVariant[s.status]} className="capitalize">
                {s.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/80">
                {s.summary}
              </p>

              {s.feedback && (
                <div className="mt-4 rounded-lg border-l-4 border-blue-300 bg-blue-50/50 p-3 dark:border-blue-700 dark:bg-blue-950/30">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-1">
                    Teacher Feedback
                  </p>
                  <p className="text-sm text-blue-900 dark:text-blue-200">{s.feedback}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              {s.status === 'pending' ? (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800">
                    <Check />
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary">
                    <Pencil />
                    Modify
                  </Button>
                  <Button size="sm" variant="destructive">
                    <X />
                    Reject
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline">
                  View Details
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
