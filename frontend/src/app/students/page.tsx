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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserPlus,
  Eye,
  X,
  Loader2,
  CloudOff,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  getStudents,
  getStudent,
  createStudent,
  deleteStudent,
  addProgressEntry,
  getTeachers,
  type Student,
  type ProgressEntry,
} from '@/lib/api';

const flagVariant: Record<string, 'purple' | 'teal' | 'amber'> = {
  IEP: 'purple',
  '504': 'amber',
  ELL: 'teal',
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

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // Add-student form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('3rd');
  const [readingLevel, setReadingLevel] = useState('');
  const [mathAbility, setMathAbility] = useState('');
  const [skills, setSkills] = useState('');
  const [ellLanguage, setEllLanguage] = useState('');
  const [ellProficiency, setEllProficiency] = useState('beginner');
  const [iepType, setIepType] = useState('');
  const [iepAccommodations, setIepAccommodations] = useState('');
  const [iepGoals, setIepGoals] = useState('');
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // Progress form state
  const [progSkill, setProgSkill] = useState('');
  const [progArea, setProgArea] = useState('math');
  const [progScore, setProgScore] = useState('');
  const [progMax, setProgMax] = useState('100');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, teachers] = await Promise.all([getStudents(), getTeachers()]);
      setStudents(s);
      if (teachers.length > 0) setTeacherId(teachers[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id: string) {
    setSelectedLoading(true);
    try {
      setSelected(await getStudent(id));
    } catch {
      setError('Failed to load student details');
    } finally {
      setSelectedLoading(false);
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await createStudent({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gradeLevel: gradeLevel || undefined,
        readingLevel: readingLevel ? Number(readingLevel) : undefined,
        mathAbility: mathAbility ? Number(mathAbility) : undefined,
        skills: skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        ellStatus: ellLanguage
          ? {
              homeLanguage: ellLanguage,
              englishProficiency:
                ellProficiency as 'beginner' | 'intermediate' | 'advanced' | 'fluent',
            }
          : undefined,
        iepDetails: iepType
          ? {
              planType: iepType as 'IEP' | '504',
              accommodations: iepAccommodations
                ? iepAccommodations.split(',').map((s) => s.trim()).filter(Boolean)
                : [],
              goals: iepGoals ? iepGoals.split(',').map((s) => s.trim()).filter(Boolean) : [],
            }
          : undefined,
        teacherId: teacherId || '',
      });
      setFirstName('');
      setLastName('');
      setGradeLevel('3rd');
      setReadingLevel('');
      setMathAbility('');
      setSkills('');
      setEllLanguage('');
      setIepType('');
      setIepAccommodations('');
      setIepGoals('');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add student');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Delete this student and all their data?')) return;
    try {
      await deleteStudent(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete student');
    }
  }

  async function handleAddProgress(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !progSkill.trim() || !progScore) return;
    try {
      await addProgressEntry(selected.id, {
        skillName: progSkill.trim(),
        skillArea: progArea,
        score: Number(progScore),
        maxScore: Number(progMax) || 100,
      });
      setProgSkill('');
      setProgScore('');
      await openDetail(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add progress');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} student{students.length !== 1 ? 's' : ''} in your class
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X /> : <UserPlus />}
          {showForm ? 'Cancel' : 'Add Student'}
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

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Student</CardTitle>
            <CardDescription>
              Core fields are required. Leave ELL/IEP fields empty if not applicable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddStudent} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">First name</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Last name</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Grade level</label>
                <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Reading</label>
                  <Input type="number" step="0.1" value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Math</label>
                  <Input type="number" step="0.1" value={mathAbility} onChange={(e) => setMathAbility(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Skills (comma separated)</label>
                <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="phonics, addition, fraction" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ELL home language (optional)</label>
                <Input value={ellLanguage} onChange={(e) => setEllLanguage(e.target.value)} placeholder="e.g. Spanish" />
              </div>
              {ellLanguage && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">English proficiency</label>
                  <select
                    value={ellProficiency}
                    onChange={(e) => setEllProficiency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="beginner">beginner</option>
                    <option value="intermediate">intermediate</option>
                    <option value="advanced">advanced</option>
                    <option value="fluent">fluent</option>
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">IEP / 504 plan (optional)</label>
                <select
                  value={iepType}
                  onChange={(e) => setIepType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">None</option>
                  <option value="IEP">IEP</option>
                  <option value="504">504</option>
                </select>
              </div>
              {iepType && (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Accommodations (comma separated)</label>
                    <Input value={iepAccommodations} onChange={(e) => setIepAccommodations(e.target.value)} placeholder="extended time, visual supports" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Goals (comma separated)</label>
                    <Input value={iepGoals} onChange={(e) => setIepGoals(e.target.value)} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                  Add Student
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Student</TableHead>
              <TableHead className="w-[80px]">Reading</TableHead>
              <TableHead className="w-[80px]">Math</TableHead>
              <TableHead className="w-[150px]">Flags</TableHead>
              <TableHead>Recent Progress</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No students yet. Click &quot;Add Student&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => {
                const name = `${student.firstName} ${student.lastName}`;
                const flags = flagsForStudent(student);
                const recent = (student.progressEntries || [])
                  .slice(-2)
                  .reverse();
                return (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="text-xs font-bold">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.gradeLevel || '—'} Grade
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {student.readingLevel ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {student.mathAbility ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {flags.length > 0 ? (
                          flags.map((flag) => (
                            <Badge
                              key={flag}
                              variant={flagVariant[flag] || 'secondary'}
                              className="text-[10px]"
                            >
                              {flag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        {recent.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No entries</span>
                        ) : (
                          recent.map((p: ProgressEntry) => (
                            <div key={p.id} className="flex items-center gap-2">
                              <span className="w-24 truncate text-xs text-muted-foreground">
                                {p.skillName}
                              </span>
                              <Progress
                                value={Math.min(100, (p.score / (p.maxScore || 100)) * 100)}
                                className="h-1.5 w-24"
                              />
                              <span className="text-xs font-medium">{p.score}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDetail(student.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemove(student.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail drawer */}
      {selected && (
        <Card className="fixed right-6 top-6 z-20 max-h-[85vh] w-[440px] overflow-auto shadow-xl">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {selected.firstName} {selected.lastName}
              </CardTitle>
              <CardDescription>
                {selected.gradeLevel || '—'} Grade
                {selected.readingLevel != null && ` · Reading ${selected.readingLevel}`}
                {selected.mathAbility != null && ` · Math ${selected.mathAbility}`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {flagsForStudent(selected).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {flagsForStudent(selected).map((f) => (
                  <Badge key={f} variant={flagVariant[f] || 'secondary'} className="text-xs">
                    {f}
                  </Badge>
                ))}
              </div>
            )}

            {selected.iepDetails && (
              <div className="rounded-lg bg-purple-50/50 p-3 text-sm dark:bg-purple-950/30">
                <p className="font-semibold text-purple-800 dark:text-purple-300">
                  {selected.iepDetails.planType}
                </p>
                {selected.iepDetails.accommodations?.length > 0 && (
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Accommodations:</span>{' '}
                    {selected.iepDetails.accommodations.join(', ')}
                  </p>
                )}
                {selected.iepDetails.goals?.length > 0 && (
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Goals:</span>{' '}
                    {selected.iepDetails.goals.join('; ')}
                  </p>
                )}
              </div>
            )}

            {selected.ellStatus && (
              <div className="rounded-lg bg-teal-50/50 p-3 text-sm dark:bg-teal-950/30">
                <p className="font-semibold text-teal-800 dark:text-teal-300">ELL</p>
                <p className="mt-1 text-xs">
                  Home language: {selected.ellStatus.homeLanguage} · English proficiency:{' '}
                  {selected.ellStatus.englishProficiency}
                </p>
              </div>
            )}

            {selected.teacherNotes && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Teacher notes</p>
                <p className="text-sm">{selected.teacherNotes}</p>
              </div>
            )}

            {/* Progress entries */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Progress entries</p>
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {(selected.progressEntries || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No progress entries yet.</p>
                ) : (
                  (selected.progressEntries || [])
                    .slice()
                    .reverse()
                    .map((p: ProgressEntry) => (
                      <div key={p.id} className="rounded-md border p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{p.skillName}</span>
                          <span className="text-xs text-muted-foreground">{shortDate(p.createdAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress
                            value={Math.min(100, (p.score / (p.maxScore || 100)) * 100)}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-xs font-medium">
                            {p.score}/{p.maxScore || 100}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <form onSubmit={handleAddProgress} className="mt-3 grid grid-cols-2 gap-2">
                <Input
                  className="col-span-2"
                  placeholder="Skill name"
                  value={progSkill}
                  onChange={(e) => setProgSkill(e.target.value)}
                />
                <select
                  value={progArea}
                  onChange={(e) => setProgArea(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="math">Math</option>
                  <option value="reading">Reading</option>
                  <option value="writing">Writing</option>
                  <option value="science">Science</option>
                  <option value="social_studies">Social Studies</option>
                  <option value="other">Other</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Score" value={progScore} onChange={(e) => setProgScore(e.target.value)} />
                  <Input type="number" placeholder="Max" value={progMax} onChange={(e) => setProgMax(e.target.value)} />
                </div>
                <Button type="submit" size="sm" variant="secondary" className="col-span-2">
                  <Plus /> Add progress entry
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
