/**
 * End-to-end test for Student Profiles (Chunk 6).
 *
 * Requires running services (docker-compose up):
 *   - PostgreSQL with pgvector at postgresql://hackgb:hackgb_dev_password@localhost:5432/hackgb
 *
 * Run: npm run test:e2e --workspace=backend
 *
 * Flow under test (mirrors the plan's "How to test"):
 *   1. Create a student with ALL profile fields (reading, math, IEP/504,
 *      ELL, learning differences, social-emotional notes, skills)
 *   2. Update progress over time and verify the timeline entries
 *      (ordered, filterable by skill area)
 *   3. Query by reading level, by skill, by learning difference
 *   4. Verify data isolation: teacher A cannot see teacher B's students
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

function configureEnv(): void {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://hackgb:hackgb_dev_password@localhost:5432/hackgb';
  process.env.MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
  process.env.MINIO_PORT = process.env.MINIO_PORT || '9000';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
  process.env.OPENAI_API_KEY = '';
  process.env.ANTHROPIC_API_KEY = '';
}

describe('Student Profiles (e2e, real Postgres)', () => {
  let app: INestApplication;
  let teacherA: string;
  let teacherB: string;
  let richStudentId: string;

  beforeAll(async () => {
    configureEnv();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors();
    await app.init();

    // Two teachers to prove data isolation
    const t1 = await request(app.getHttpServer())
      .post('/api/teachers')
      .send({
        email: `e2e-profile-a-${Date.now()}@test.com`,
        firstName: 'Profile',
        lastName: 'TeacherA',
      });
    expect(t1.status).toBe(201);
    teacherA = t1.body.id;

    const t2 = await request(app.getHttpServer())
      .post('/api/teachers')
      .send({
        email: `e2e-profile-b-${Date.now()}@test.com`,
        firstName: 'Profile',
        lastName: 'TeacherB',
      });
    expect(t2.status).toBe(201);
    teacherB = t2.body.id;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates a student with all profile fields and returns them', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/students')
      .send({
        firstName: 'Ava',
        lastName: 'Patel',
        gradeLevel: '3rd',
        readingLevel: 3.4,
        mathAbility: 3.1,
        skills: ['phonics', 'addition', 'fraction'],
        iepDetails: {
          planType: '504',
          accommodations: ['extended time', 'seating near the front'],
          goals: ['improve focus on multi-step problems'],
          lastReviewed: '2026-09-01',
          notes: 'Responds well to movement breaks',
        },
        ellStatus: {
          homeLanguage: 'Hindi',
          englishProficiency: 'intermediate',
          ellStartDate: '2025-09-01',
        },
        learningDifferences: [
          { type: 'ADHD', diagnosed: true, notes: 'diagnosed 2025' },
        ],
        socialEmotionalNotes: 'Works best in small groups; gains confidence with praise.',
        teacherNotes: 'Prefers hands-on activities.',
        teacherId: teacherA,
      });
    expect(res.status).toBe(201);
    richStudentId = res.body.id;

    // Every multi-modal field round-trips
    expect(res.body.gradeLevel).toBe('3rd');
    expect(res.body.readingLevel).toBe(3.4);
    expect(res.body.mathAbility).toBe(3.1);
    expect(res.body.skills).toEqual(
      expect.arrayContaining(['phonics', 'addition', 'fraction']),
    );
    expect(res.body.iepDetails.planType).toBe('504');
    expect(res.body.iepDetails.accommodations).toContain('extended time');
    expect(res.body.ellStatus.homeLanguage).toBe('Hindi');
    expect(res.body.ellStatus.englishProficiency).toBe('intermediate');
    expect(res.body.learningDifferences[0].type).toBe('ADHD');
    expect(res.body.socialEmotionalNotes).toBeTruthy();
    expect(res.body.teacherNotes).toBeTruthy();
    expect(res.body.teacher.id).toBe(teacherA);
  });

  it('builds a progress timeline over time and returns it ordered', async () => {
    // Three entries over "time" (created moments apart)
    for (const [name, score] of [
      ['addition', 70],
      ['fraction', 62],
      ['addition', 78],
    ] as Array<[string, number]>) {
      const res = await request(app.getHttpServer())
        .post(`/api/students/${richStudentId}/progress`)
        .send({
          skillArea: 'math',
          skillName: name,
          score,
          maxScore: 100,
          notes: score === 78 ? 'improved with base ten blocks' : undefined,
        });
      expect(res.status).toBe(201);
    }

    // Full timeline: newest first, all 3 entries, all for this student
    const list = await request(app.getHttpServer()).get(
      `/api/students/${richStudentId}/progress`,
    );
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(3);
    const dates = list.body.map((e: any) => new Date(e.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
    const scores = list.body.map((e: any) => e.score);
    expect(scores).toEqual(expect.arrayContaining([70, 62, 78]));

    // Filter by skill area
    const math = await request(app.getHttpServer()).get(
      `/api/students/${richStudentId}/progress?skillArea=math`,
    );
    expect(math.status).toBe(200);
    expect(math.body.length).toBe(3);
    for (const e of math.body) {
      expect(e.skillArea).toBe('math');
    }

    // Filter for a skill area with no entries returns empty
    const reading = await request(app.getHttpServer()).get(
      `/api/students/${richStudentId}/progress?skillArea=reading`,
    );
    expect(reading.status).toBe(200);
    expect(reading.body).toHaveLength(0);

    // The student object embeds the timeline too
    const student = await request(app.getHttpServer()).get(
      `/api/students/${richStudentId}`,
    );
    expect(student.status).toBe(200);
    expect(student.body.progressEntries.length).toBe(3);
  });

  it('queries students by reading level range', async () => {
    // A second student with a distinct reading level, same teacher
    const low = await request(app.getHttpServer())
      .post('/api/students')
      .send({
        firstName: 'Noah',
        lastName: 'Williams',
        gradeLevel: '3rd',
        readingLevel: 2.6,
        mathAbility: 2.4,
        skills: ['phonics'],
        teacherId: teacherA,
      });
    expect(low.status).toBe(201);

    // Range covering Ava (3.4) but not Noah (2.6)
    const inRange = await request(app.getHttpServer()).get(
      `/api/students/query/reading-level?teacherId=${teacherA}&minLevel=3&maxLevel=4`,
    );
    expect(inRange.status).toBe(200);
    const names = inRange.body.map((s: any) => s.id);
    expect(names).toContain(richStudentId);
    expect(names).not.toContain(low.body.id);

    // Min-only bound: both students at >= 2
    const minOnly = await request(app.getHttpServer()).get(
      `/api/students/query/reading-level?teacherId=${teacherA}&minLevel=2`,
    );
    expect(minOnly.status).toBe(200);
    const minNames = minOnly.body.map((s: any) => s.id);
    expect(minNames).toContain(richStudentId);
    expect(minNames).toContain(low.body.id);
  });

  it('queries students by skill (exact, JSONB containment)', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/students/query/skill?teacherId=${teacherA}&skill=fraction`,
    );
    expect(res.status).toBe(200);
    const names = res.body.map((s: any) => s.id);
    expect(names).toContain(richStudentId);

    // A skill no student has returns empty
    const none = await request(app.getHttpServer()).get(
      `/api/students/query/skill?teacherId=${teacherA}&skill=trigonometry`,
    );
    expect(none.status).toBe(200);
    expect(none.body).toHaveLength(0);
  });

  it('queries students by learning difference', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/students/query/learning-difference?teacherId=${teacherA}&type=ADHD`,
    );
    expect(res.status).toBe(200);
    const names = res.body.map((s: any) => s.id);
    expect(names).toContain(richStudentId);

    const none = await request(app.getHttpServer()).get(
      `/api/students/query/learning-difference?teacherId=${teacherA}&type=dyscalculia`,
    );
    expect(none.status).toBe(200);
    expect(none.body).toHaveLength(0);
  });

  it('isolates student data between teachers', async () => {
    // Teacher B lists students: must NOT see teacher A's students
    const bList = await request(app.getHttpServer()).get(
      `/api/students?teacherId=${teacherB}`,
    );
    expect(bList.status).toBe(200);
    for (const s of bList.body) {
      expect(s.id).not.toBe(richStudentId);
    }

    // Teacher B queries by reading level: still no leakage
    const bQuery = await request(app.getHttpServer()).get(
      `/api/students/query/reading-level?teacherId=${teacherB}&minLevel=1&maxLevel=5`,
    );
    expect(bQuery.status).toBe(200);
    for (const s of bQuery.body) {
      expect(s.id).not.toBe(richStudentId);
    }

    // Teacher A still sees their own student through the same query
    const aQuery = await request(app.getHttpServer()).get(
      `/api/students/query/reading-level?teacherId=${teacherA}&minLevel=3&maxLevel=4`,
    );
    expect(aQuery.status).toBe(200);
    expect(aQuery.body.map((s: any) => s.id)).toContain(richStudentId);

    // Teacher A can update + delete their own student without affecting B
    const upd = await request(app.getHttpServer())
      .put(`/api/students/${richStudentId}`)
      .send({ readingLevel: 3.5, teacherNotes: 'Updated notes' });
    expect(upd.status).toBe(200);
    expect(upd.body.readingLevel).toBe(3.5);
    expect(upd.body.teacherNotes).toBe('Updated notes');

    const del = await request(app.getHttpServer()).delete(
      `/api/students/${richStudentId}`,
    );
    expect(del.status).toBe(200);

    // The student profile is now gone
    const gone = await request(app.getHttpServer()).get(
      `/api/students/${richStudentId}`,
    );
    expect(gone.status).toBe(404);

    // Cascade: progress entries are removed with the student (empty timeline)
    const prog = await request(app.getHttpServer()).get(
      `/api/students/${richStudentId}/progress`,
    );
    expect(prog.status).toBe(200);
    expect(prog.body).toHaveLength(0);
  });
});
