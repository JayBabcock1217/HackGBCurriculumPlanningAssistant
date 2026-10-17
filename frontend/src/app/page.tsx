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
} from 'lucide-react';

const stats = [
  {
    label: 'Students',
    value: '24',
    change: '+2 this month',
    icon: Users,
  },
  {
    label: 'Curricula',
    value: '5',
    change: '89 chunks indexed',
    icon: BookOpen,
  },
  {
    label: 'Pending Suggestions',
    value: '8',
    change: '3 need review',
    icon: Lightbulb,
  },
  {
    label: 'Feedback Entries',
    value: '47',
    change: '92% acceptance rate',
    icon: MessageSquare,
  },
];

const recentStudents = [
  { name: 'Emma Davis', reading: 3.2, math: 2.8, flags: ['IEP'] },
  { name: 'Liam Chen', reading: 3.5, math: 3.1, flags: [] },
  { name: 'Sofia Rodriguez', reading: 2.9, math: 2.5, flags: ['ELL'] },
  { name: 'Noah Williams', reading: 3.8, math: 3.4, flags: [] },
  { name: 'Ava Patel', reading: 3.1, math: 3.3, flags: ['504'] },
];

const recentSuggestions = [
  {
    title: 'Fraction Addition - Scaffolded',
    student: 'Sofia Rodriguez',
    status: 'pending',
    date: 'Oct 15',
  },
  {
    title: 'Word Problems - Visual Approach',
    student: 'Emma Davis',
    status: 'accepted',
    date: 'Oct 14',
  },
  {
    title: 'Multiplication Tables - Drill',
    student: 'Liam Chen',
    status: 'modified',
    date: 'Oct 13',
  },
];

const skillMastery = [
  { skill: 'Addition', value: 78 },
  { skill: 'Subtraction', value: 72 },
  { skill: 'Multiplication', value: 54 },
  { skill: 'Division', value: 41 },
  { skill: 'Fractions', value: 35 },
];

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

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, Sarah. Here&apos;s an overview of your class.
          </p>
        </div>
        <Button asChild>
          <Link href="/suggestions">
            <Lightbulb />
            Review Suggestions
          </Link>
        </Button>
      </div>

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
              <CardDescription>5 of 24 shown</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/students">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentStudents.map((student) => (
              <div
                key={student.name}
                className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="text-xs font-bold">
                      {student.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Reading {student.reading} · Math {student.math}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {student.flags.map((flag) => (
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
            ))}
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
            {recentSuggestions.map((s) => (
              <div
                key={s.title}
                className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.student} · {s.date}
                  </p>
                </div>
                <Badge variant={statusVariant[s.status]} className="capitalize">
                  {s.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Skill Mastery */}
      <Card>
        <CardHeader>
          <CardTitle>Class Skill Mastery</CardTitle>
          <CardDescription>
            Average performance across all students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {skillMastery.map((item) => (
            <div key={item.skill} className="flex items-center gap-4">
              <span className="w-28 text-sm text-muted-foreground">
                {item.skill}
              </span>
              <Progress value={item.value} className="flex-1" />
              <span className="w-10 text-right text-sm font-medium">
                {item.value}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
