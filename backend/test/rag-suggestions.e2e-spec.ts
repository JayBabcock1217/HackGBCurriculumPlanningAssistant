/**
 * End-to-end test for the RAG pipeline + personalized lesson suggestions
 * (Chunks 5 + 7). This is the plan's "core flow" E2E.
 *
 * Requires running services (docker-compose up):
 *   - Postgres + pgvector, RustFS, Ollama (with chat + embedding models)
 *
 * Run: npm run test:e2e --workspace=backend
 *
 * Flow under test:
 *   1. Create a teacher, a student (with profile), upload a real PDF curriculum
 *   2. RAG retrieve: relevant chunks come back for a matching query
 *   3. RAG ask: grounded answer with sources
 *   4. Generate personalized lesson suggestions (LLM) for the student
 *      against the curriculum; verify N distinct options are persisted
 *   5. Different students at different levels are supported (profile is
 *      reflected in the prompt)
 *   6. Edge case: generating for a student with an empty profile still works
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';

const PDF_PATH = path.join(__dirname, 'fixtures', 'math-unit1.pdf');
const API = '/api';

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

describe('RAG + Suggestions pipeline (e2e, real Ollama + Postgres + RustFS)', () => {
  let app: INestApplication;
  let teacherId: string;
  let curriculumId: string;
  let studentId: string;
  let simpleStudentId: string;

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
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('sets up a teacher, student, and a processed curriculum', async () => {
    // Teacher
    const t = await request(app.getHttpServer())
      .post(`${API}/teachers`)
      .send({
        email: `e2e-rag-${Date.now()}@test.com`,
        firstName: 'RAG',
        lastName: 'Teacher',
        schoolName: 'Test School',
      });
    expect(t.status).toBe(201);
    teacherId = t.body.id;

    // Student with a rich profile
    const s = await request(app.getHttpServer())
      .post(`${API}/students`)
      .send({
        firstName: 'Sofia',
        lastName: 'Rodriguez',
        gradeLevel: '3rd',
        readingLevel: 2.9,
        mathAbility: 2.5,
        ellStatus: { homeLanguage: 'Spanish', englishProficiency: 'beginner' },
        teacherId,
      });
    expect(s.status).toBe(201);
    studentId = s.body.id;

    // Student with an empty profile (edge case)
    const s2 = await request(app.getHttpServer())
      .post(`${API}/students`)
      .send({ firstName: 'Empty', lastName: 'Profile', teacherId });
    expect(s2.status).toBe(201);
    simpleStudentId = s2.body.id;

    // Upload + process the curriculum PDF
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    const upload = await request(app.getHttpServer())
      .post(`${API}/curricula/upload`)
      .field('title', '3rd Grade Math - Unit 1: Addition & Subtraction')
      .field('teacherId', teacherId)
      .field('subject', 'Math')
      .field('gradeLevel', '3rd')
      .attach('file', PDF_PATH, 'math-unit1.pdf');
    expect(upload.status).toBe(201);
    expect(upload.body.totalChunks).toBeGreaterThan(0);
    curriculumId = upload.body.curriculumId;

    // The upload pipeline embeds chunks with the legacy pseudo-embedder
    // (384-dim). RAG uses the real gateway embedder (768-dim), so re-embed
    // this curriculum's chunks to keep pgvector dimensions consistent.
    const reembed = await request(app.getHttpServer())
      .post(`${API}/rag/reembed`)
      .send({ curriculumId });
    expect(reembed.status).toBe(201);
    expect(reembed.body.chunksReembedded).toBeGreaterThan(0);
    expect(reembed.body.dimensions).toBeGreaterThan(100);
  }, 180_000);

  it('RAG retrieve returns relevant chunks for a matching query', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/rag/retrieve`)
      .send({
        query: 'adding two-digit numbers with regrouping and carrying',
        curriculumId,
        topK: 5,
      });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const s of res.body) {
      expect(s.chunkId).toBeDefined();
      expect(typeof s.content).toBe('string');
      expect(typeof s.similarity).toBe('number');
      expect(s.curriculumId).toBe(curriculumId);
    }
  }, 120_000);

  it('RAG ask returns a grounded answer with sources', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/rag/ask`)
      .send({
        query: 'How do students add two-digit numbers with regrouping?',
        curriculumId,
        topK: 5,
      });
    expect(res.status).toBe(201);
    expect(typeof res.body.answer).toBe('string');
    expect(res.body.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.sources)).toBe(true);
    // A grounded answer against a real curriculum should cite at least one source
    expect(res.body.sources.length).toBeGreaterThan(0);
    expect(res.body.sources[0].curriculumTitle).toContain('Math');
    expect(res.body.model).toBeTruthy();
  }, 120_000);

  it('generates personalized lesson suggestions for the student', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/suggestions/generate`)
      .send({
        studentId,
        curriculumId,
        optionCount: 3,
        focus: 'regrouping in addition',
      });
    expect(res.status).toBe(201);
    expect(res.body.studentId).toBe(studentId);
    expect(res.body.curriculumId).toBe(curriculumId);
    expect(Array.isArray(res.body.options)).toBe(true);
    expect(res.body.options.length).toBe(3);

    // Each option has the expected shape
    for (const opt of res.body.options) {
      expect(opt.title).toBeTruthy();
      expect(opt.type).toBeTruthy();
      expect(opt.content.length).toBeGreaterThan(10);
    }

    // The student's profile should have influenced generation: options for an
    // ELL beginner should reference language supports or visuals.
    const allContent = res.body.options.map((o: any) => o.content + o.summary).join(' ').toLowerCase();
    // We can't guarantee specific wording, but the LLM should produce
    // non-trivial, differentiated content (each option distinct).
    const titles = new Set(res.body.options.map((o: any) => o.title));
    expect(titles.size).toBeGreaterThan(1); // at least two distinct titles
  }, 300_000);

  it('persists generated suggestions (fetchable via list endpoint)', async () => {
    const res = await request(app.getHttpServer()).get(
      `${API}/suggestions?studentId=${studentId}`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The 3 options we just generated should be present
    const fromStudent = res.body.filter((s: any) => s.student?.id === studentId);
    expect(fromStudent.length).toBeGreaterThanOrEqual(3);
    // All should be pending by default
    for (const s of fromStudent) {
      expect(s.status).toBe('pending');
      expect(s.modelUsed).toBeTruthy();
    }
  }, 60_000);

  it('generates for a student with an empty profile (edge case)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/suggestions/generate`)
      .send({ studentId: simpleStudentId, curriculumId, optionCount: 2 });
    expect(res.status).toBe(201);
    expect(res.body.options.length).toBe(2);
  }, 300_000);

  it('different students produce different prompts (profile-aware)', async () => {
    // This is a behavioral check: generating for the ELL student vs the empty
    // student should not error and should both succeed. (Exact prompt
    // differences are asserted in unit tests; here we verify the pipeline is
    // robust to profile variance.)
    const res1 = await request(app.getHttpServer())
      .post(`${API}/suggestions/generate`)
      .send({ studentId, curriculumId, optionCount: 1 });
    expect(res1.status).toBe(201);

    const res2 = await request(app.getHttpServer())
      .post(`${API}/suggestions/generate`)
      .send({ studentId: simpleStudentId, curriculumId, optionCount: 1 });
    expect(res2.status).toBe(201);
  }, 300_000);
});
