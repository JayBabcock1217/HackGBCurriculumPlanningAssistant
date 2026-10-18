import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProgressEntry } from './progress-entry.entity';
import { Student } from './student.entity';

export interface StudentTimeline {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel: string | null;
  };
  /** Chronological (oldest -> newest) entries, each with a computed percent. */
  entries: EntryRow[];
  /** Per-skill average percent across all entries (for the mastery chart). */
  skillAverages: Array<{ skill: string; skillArea: string; percent: number; entries: number }>;
}

/** A single progress entry with its computed percent (shared by both timelines). */
export interface EntryRow {
  id: string;
  skillArea: string;
  skillName: string;
  score: number;
  maxScore: number;
  percent: number;
  notes: string | null;
  createdAt: string;
}

export interface ClassTimeline {
  teacherId: string;
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    entryCount: number;
    latestPercent: number | null;
    /** Most recent entry (or null for a brand-new student with no data). */
    latest: EntryRow | null;
  }>;
  /** Class-wide average percent per skill (for the class mastery chart). */
  skillAverages: Array<{ skill: string; percent: number; entries: number }>;
  /** Class-wide average percent per entry date (for the over-time chart). */
  overTime: Array<{ date: string; percent: number; entries: number }>;
}

/**
 * ProgressService (Chunk 9)
 *
 * Aggregation endpoints for the progress dashboards:
 *   - per-student timeline (chronological entries + per-skill mastery)
 *   - per-class timeline (per-student summary + class skill mastery + over-time)
 *
 * These read from progress_entries and are intentionally read-only.
 */
@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(ProgressEntry)
    private progressRepo: Repository<ProgressEntry>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
  ) {}

  async studentTimeline(studentId: string): Promise<StudentTimeline> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    const entries = await this.progressRepo.find({
      where: { student: { id: studentId } },
      order: { createdAt: 'ASC' },
    });

    const entryRows = entries.map((e) => this.toEntryRow(e));

    const skillAverages = this.computeSkillAverages(entryRows);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        gradeLevel: student.gradeLevel,
      },
      entries: entryRows,
      skillAverages,
    };
  }

  async classTimeline(teacherId: string): Promise<ClassTimeline> {
    const students = await this.studentRepo.find({
      where: { teacher: { id: teacherId } },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });

    // Gather all progress entries for this teacher's students in one query.
    const studentIds = students.map((s) => s.id);
    const allEntries =
      studentIds.length > 0
        ? await this.progressRepo.find({
            where: { student: { id: In(studentIds) } },
            order: { createdAt: 'ASC' },
          })
        : [];

    const byStudent = new Map<string, typeof allEntries>();
    for (const e of allEntries) {
      const sid = (e.student as any)?.id;
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid)!.push(e);
    }

    const studentRows = students.map((s) => {
      const es = byStudent.get(s.id) || [];
      const last = es.length > 0 ? this.toEntryRow(es[es.length - 1]) : null;
      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        entryCount: es.length,
        latestPercent: last?.percent ?? null,
        latest: last,
      };
    });

    const entryRows = allEntries.map((e) => this.toEntryRow(e));

    // Class skill mastery: average percent per skillName across all entries.
    const skillAverages = this.computeSkillAverages(entryRows)
      .map((s) => ({ skill: s.skill, percent: s.percent, entries: s.entries }))
      .sort((a, b) => b.percent - a.percent);

    // Over time: average percent per calendar day.
    const dayMap = new Map<string, { total: number; count: number }>();
    for (const e of entryRows) {
      const day = e.createdAt.slice(0, 10);
      const cur = dayMap.get(day) || { total: 0, count: 0 };
      cur.total += e.percent;
      cur.count += 1;
      dayMap.set(day, cur);
    }
    const overTime = Array.from(dayMap.entries())
      .map(([date, v]) => ({
        date,
        percent: Math.round(v.total / v.count),
        entries: v.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      teacherId,
      students: studentRows,
      skillAverages,
      overTime,
    };
  }

  private toEntryRow(e: ProgressEntry): EntryRow {
    const maxScore = e.maxScore ?? 100;
    return {
      id: e.id,
      skillArea: e.skillArea,
      skillName: e.skillName,
      score: e.score,
      maxScore,
      percent: Math.min(100, Math.round((e.score / maxScore) * 100)),
      notes: e.notes,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    };
  }

  private computeSkillAverages(
    entryRows: Array<{ skillName: string; skillArea: string; percent: number }>,
  ): Array<{ skill: string; skillArea: string; percent: number; entries: number }> {
    const map = new Map<string, { total: number; count: number; skillArea: string }>();
    for (const e of entryRows) {
      const cur = map.get(e.skillName) || { total: 0, count: 0, skillArea: e.skillArea };
      cur.total += e.percent;
      cur.count += 1;
      map.set(e.skillName, cur);
    }
    return Array.from(map.entries())
      .map(([skill, v]) => ({
        skill,
        skillArea: v.skillArea,
        percent: Math.round(v.total / v.count),
        entries: v.count,
      }))
      .sort((a, b) => b.percent - a.percent);
  }
}
