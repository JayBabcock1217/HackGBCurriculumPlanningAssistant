/**
 * End-to-end smoke test for the curriculum processing pipeline.
 *
 * Requires running services (docker-compose up):
 *   - PostgreSQL with pgvector at postgresql://hackgb:hackgb_dev_password@localhost:5432/hackgb
 *   - MinIO at localhost:9000
 *
 * Run: npm run test:e2e --workspace=backend
 *
 * Pipeline under test:
 *   1. Create teacher
 *   2. Upload PDF → MinIO storage → parse → chunk → embed → pgvector
 *   3. Verify curriculum + chunks are persisted
 *   4. Vector similarity search returns relevant chunks
 *   5. Delete curriculum + file
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

const PDF_PATH = path.join(__dirname, 'fixtures', 'math-unit1.pdf');
const API = '/api';

describe('Curriculum Pipeline (e2e)', () => {
  let app: INestApplication;
  let teacherId: string;
  let curriculumId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://hackgb:hackgb_dev_password@localhost:5432/hackgb';
    process.env.MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
    process.env.MINIO_PORT = process.env.MINIO_PORT || '9000';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('health check responds', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/health`);
    expect(res.status).toBe(200);
  }, 30_000);

  it('creates a teacher', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/teachers`)
      .send({
        email: `e2e-${Date.now()}@test.com`,
        firstName: 'E2E',
        lastName: 'Teacher',
        schoolName: 'Test School',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    teacherId = res.body.id;
  }, 30_000);

  it('uploads a PDF and processes it through the full pipeline', async () => {
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    expect(pdfBuffer.length).toBeGreaterThan(100);

    const res = await request(app.getHttpServer())
      .post(`${API}/curricula/upload`)
      .field('title', '3rd Grade Math - Unit 1: Addition & Subtraction')
      .field('teacherId', teacherId)
      .field('subject', 'Math')
      .field('gradeLevel', '3rd')
      .attach('file', PDF_PATH, 'math-unit1.pdf');

    expect(res.status).toBe(201);
    expect(res.body.curriculumId).toBeDefined();
    expect(res.body.totalChunks).toBeGreaterThan(0);
    expect(res.body.totalCharacters).toBeGreaterThan(100);
    expect(res.body.processingTimeMs).toBeGreaterThanOrEqual(0);
    curriculumId = res.body.curriculumId;
  }, 60_000);

  it('persists the curriculum with chunk count', async () => {
    const res = await request(app.getHttpServer()).get(
      `${API}/curricula/${curriculumId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(
      '3rd Grade Math - Unit 1: Addition & Subtraction',
    );
    expect(res.body.fileType).toBe('pdf');
    expect(res.body.fileUrl).toContain('curricula/');
    expect(res.body.chunkCount).toBeGreaterThan(0);
    expect(res.body.metadata.totalCharacters).toBeGreaterThan(100);
  }, 30_000);

  it('persists chunks with serialized embeddings', async () => {
    const res = await request(app.getHttpServer()).get(
      `${API}/curricula/${curriculumId}/chunks`,
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    // Each chunk should have content, an index, and a serialized vector
    for (const chunk of res.body) {
      expect(typeof chunk.content).toBe('string');
      expect(chunk.content.length).toBeGreaterThan(10);
      expect(typeof chunk.chunkIndex).toBe('number');
      expect(typeof chunk.tokenCount).toBe('number');
      // pgvector text format: [0.1,0.2,...]
      expect(chunk.embedding).toMatch(/^\[.+,.*\]$/);
    }

    // Chunk indices should be sequential starting at 0
    const indices = res.body.map((c: any) => c.chunkIndex);
    indices.sort((a: number, b: number) => a - b);
    expect(indices[0]).toBe(0);
  }, 30_000);

  it('vector search finds content relevant to the query', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/curricula/search`)
      .send({
        query: 'adding two-digit numbers with regrouping and carrying',
        curriculumId,
        limit: 5,
      });
    expect(res.status).toBe(201);
    expect(res.body.length).toBeGreaterThan(0);

    // Results should come from our curriculum
    for (const result of res.body) {
      expect(result.curriculum.id).toBe(curriculumId);
      expect(typeof result.content).toBe('string');
      expect(typeof result.distance).toBe('number');
      expect(result.distance).toBeGreaterThanOrEqual(0);
    }

    // The most relevant chunk should mention addition (top result)
    const top = res.body[0];
    expect(top.content.toLowerCase()).toMatch(/addition|adding/);
  }, 30_000);

  it('search returns more relevant results for matching queries', async () => {
    const relevant = await request(app.getHttpServer())
      .post(`${API}/curricula/search`)
      .send({ query: 'addition with regrouping tens ones', curriculumId });

    const irrelevant = await request(app.getHttpServer())
      .post(`${API}/curricula/search`)
      .send({ query: 'quantum physics entanglement thermodynamics', curriculumId });

    expect(relevant.status).toBe(201);
    expect(irrelevant.status).toBe(201);

    // Top result for the relevant query should be closer (lower distance)
    // than the top result for the irrelevant query
    expect(relevant.body[0].distance).toBeLessThan(irrelevant.body[0].distance);
  }, 30_000);

  it('downloads the original file', async () => {
    const res = await request(app.getHttpServer()).get(
      `${API}/curricula/${curriculumId}/file`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('math-unit1.pdf');
    // File should round-trip through MinIO unchanged
    const original = fs.readFileSync(PDF_PATH);
    expect(Buffer.from(res.body)).toEqual(original);
  }, 30_000);

  it('deletes the curriculum and its file', async () => {
    const delRes = await request(app.getHttpServer()).delete(
      `${API}/curricula/${curriculumId}/file`,
    );
    expect(delRes.status).toBe(200);

    // Curriculum should be gone
    const getRes = await request(app.getHttpServer()).get(
      `${API}/curricula/${curriculumId}`,
    );
    expect(getRes.status).toBe(404);
  }, 30_000);
});
