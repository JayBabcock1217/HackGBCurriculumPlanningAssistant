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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Eye } from 'lucide-react';

const students = [
  {
    id: '1',
    name: 'Emma Davis',
    grade: '3rd',
    reading: 3.2,
    math: 2.8,
    flags: ['IEP', 'Dyslexia'],
    progress: [
      { skill: 'Addition', score: 82, max: 100, date: 'Oct 15' },
      { skill: 'Phonics', score: 75, max: 100, date: 'Oct 10' },
    ],
  },
  {
    id: '2',
    name: 'Liam Chen',
    grade: '3rd',
    reading: 3.5,
    math: 3.1,
    flags: [],
    progress: [
      { skill: 'Multiplication', score: 88, max: 100, date: 'Oct 15' },
      { skill: 'Addition', score: 92, max: 100, date: 'Oct 10' },
    ],
  },
  {
    id: '3',
    name: 'Sofia Rodriguez',
    grade: '3rd',
    reading: 2.9,
    math: 2.5,
    flags: ['ELL'],
    progress: [
      { skill: 'Phonics', score: 68, max: 100, date: 'Oct 15' },
      { skill: 'Addition', score: 71, max: 100, date: 'Oct 10' },
    ],
  },
  {
    id: '4',
    name: 'Noah Williams',
    grade: '3rd',
    reading: 3.8,
    math: 3.4,
    flags: [],
    progress: [
      { skill: 'Fractions', score: 80, max: 100, date: 'Oct 15' },
      { skill: 'Multiplication', score: 90, max: 100, date: 'Oct 10' },
    ],
  },
  {
    id: '5',
    name: 'Ava Patel',
    grade: '3rd',
    reading: 3.1,
    math: 3.3,
    flags: ['504', 'ADHD'],
    progress: [
      { skill: 'Multiplication', score: 85, max: 100, date: 'Oct 15' },
      { skill: 'Addition', score: 91, max: 100, date: 'Oct 10' },
    ],
  },
];

const flagVariant: Record<string, 'purple' | 'teal' | 'amber'> = {
  IEP: 'purple',
  ELL: 'teal',
  '504': 'amber',
  ADHD: 'amber',
  Dyslexia: 'amber',
};

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            24 students in 3rd Grade Math
          </p>
        </div>
        <Button>
          <UserPlus />
          Add Student
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Student</TableHead>
              <TableHead className="w-[80px]">Reading</TableHead>
              <TableHead className="w-[80px]">Math</TableHead>
              <TableHead className="w-[150px]">Flags</TableHead>
              <TableHead>Recent Progress</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
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
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.grade} Grade
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-semibold">{student.reading}</span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold">{student.math}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {student.flags.length > 0 ? (
                      student.flags.map((flag) => (
                        <Badge
                          key={flag}
                          variant={flagVariant[flag] || 'secondary'}
                          className="text-[10px]"
                        >
                          {flag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    {student.progress.map((p) => (
                      <div key={p.skill} className="flex items-center gap-2">
                        <span className="w-20 text-xs text-muted-foreground">
                          {p.skill}
                        </span>
                        <Progress
                          value={(p.score / p.max) * 100}
                          className="h-1.5 w-24"
                        />
                        <span className="text-xs font-medium">
                          {p.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
