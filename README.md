# HackGB Curriculum Planning Assistant

A self-hosted web app that helps teachers record student progress against
their curriculum and generate personalized, curriculum-grounded lesson plans
with a local or cloud LLM.

## What it does

- **Student profiles** — rich multi-modal profiles (reading level, math
  ability, IEP/504, ELL, learning differences, social-emotional notes) with
  a per-student progress timeline.
- **Curriculum indexing** — upload PDF/Word docs; they are stored in RustFS,
  parsed, chunked, embedded, and stored in PostgreSQL + pgvector for
  similarity search.
- **RAG + personalized suggestions** — the LLM retrieves the most relevant
  curriculum chunks and generates multiple distinct lesson options tailored
  to each student, learning from the teacher's past feedback.
- **Teacher feedback loop** — accept/modify/reject suggestions with reasons;
  past feedback is retrieved by similarity + recency and injected into future
  prompts so the model improves per teacher.
- **Progress dashboards** — class- and per-student skill-mastery and
  over-time charts.
- **Resource generation** — teacher-initiated worksheets, readings, and
  practice problems with a live progress indicator.
- **Auth & roles** — email/password login with JWT sessions, teacher/admin
  roles, and per-teacher data isolation.
- **Multi-language** — English + Spanish UI, plus an independent setting for
  the language of generated content.

## Architecture

| Service    | Tech                              | Purpose                                  |
|------------|-----------------------------------|------------------------------------------|
| frontend   | Next.js 15 + Tailwind + recharts  | Teacher UI                               |
| backend    | NestJS + TypeORM                  | API, RAG, LLM gateway, auth              |
| postgres   | PostgreSQL 16 + pgvector          | Data + vector search                     |
| rustfs     | RustFS (S3-compatible)            | Curriculum file storage                  |
| ollama     | Ollama                            | Local chat + embedding models            |

The LLM provider is config-driven: Ollama (default, local), OpenAI, or
Anthropic — swappable via environment variables.

## Requirements

- **Docker** and the **Docker Compose** plugin (or standalone
  `docker-compose`).
- ~4 GB free disk for images + data, and ~16 GB RAM recommended if you plan
  to run larger Ollama models (the default 1B model runs in ~2–4 GB).

## Quick start

```bash
# 1. Clone and enter the repo
cd HackGBCurriculumPlanningAssistant

# 2. Build + start the whole stack
npm run start
```

`npm run start` allocates the first free host ports (backend in 3100–3199,
frontend in 3200–3299), builds the images, starts the containers, and waits
until the backend and frontend actually respond. It prints the URLs, e.g.:

```
Backend   : http://localhost:3100/api/health
Frontend  : http://localhost:3200   (open this in your browser)
```

Open the **Frontend** URL. On first run you will see the **login** page.

### 1. Create your account

Click **Create an account**, enter a name, email, and password. This creates
your teacher profile and signs you in.

> **First admin:** the first account you create is a regular *teacher*. To
> promote an account to *admin* (needed only for the user-management page),
> see “Promoting an admin” below.

### 2. Load a model into Ollama

The stack starts an Ollama container. Pull the default models once (run this
on the host, or `docker exec` into the container):

```bash
docker exec -it hackgb-ollama ollama pull llama3.2:1b
docker exec -it hackgb-ollama ollama pull nomic-embed-text
```

- `llama3.2:1b` — chat model used for suggestions/resources.
- `nomic-embed-text` — embedding model used for curriculum + feedback search.

(You can also point the app at OpenAI or Anthropic instead of Ollama — see
Configuration.)

### 3. Use the app

1. **Students** — add students and record progress entries (skill, score,
   max).
2. **Curricula** — upload a PDF/Word. It is parsed, chunked, embedded, and
   indexed. Use *Search Indexed Content* to verify retrieval.
3. **Suggestions** — pick a student + curriculum and generate lesson options.
   Accept/modify/reject them with reasons.
4. **Feedback** — review and edit your feedback history.
5. **Progress** — view class + per-student mastery and over-time charts.
6. **Resources** — generate a worksheet/reading/practice set on demand.

## Everyday commands

| Command          | What it does                                            |
|------------------|---------------------------------------------------------|
| `npm run start`  | Build + start the stack (allocates free ports).         |
| `npm run stop`   | Stop + remove containers (keeps your data).             |
| `npm run status` | Show what is running + health of each service.          |
| `npm run logs`   | Tail backend + frontend logs.                           |
| `npm run docker:up` | Start without rebuilding (use existing images).     |

## Configuration

All configuration is via environment variables, set in `docker-compose.yml`
(or an `.env` file next to it). The main ones:

| Variable               | Default                                  | Meaning                                   |
|------------------------|------------------------------------------|-------------------------------------------|
| `DATABASE_URL`         | `postgresql://hackgb:...@postgres:5432/hackgb` | Database connection (inside the compose network). |
| `MINIO_ENDPOINT` / `MINIO_PORT` | `rustfs` / `9000`               | Object storage (RustFS).                  |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `hackgb` / `hackgb_dev_password` | Object storage credentials.            |
| `OLLAMA_URL`           | `http://ollama:11434`                     | Ollama endpoint.                          |
| `LLM_PROVIDER`         | `ollama`                                  | `ollama`, `openai`, or `anthropic`.       |
| `AUTH_JWT_SECRET`      | dev secret                                | **Set this in production** — signs login tokens. |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:3100`                   | Baked into the frontend at build time (the backend port). |

### Using OpenAI or Anthropic instead of Ollama

Set in `docker-compose.yml` under the `backend` service:

```yaml
environment:
  LLM_PROVIDER: openai
  OPENAI_API_KEY: sk-...
```

or:

```yaml
environment:
  LLM_PROVIDER: anthropic
  ANTHROPIC_API_KEY: sk-ant-...
```

The embedding model still uses Ollama (`nomic-embed-text`) by default; cloud
embedding can be enabled the same way if your provider supports it.

## Promoting an admin

Only *admin* accounts can open the **Users** page to manage roles. To create
the first admin:

1. Register a normal account through the UI.
2. Promote it via the API (one-time setup):

   ```bash
   # Get a token by logging in
   TOKEN=$(curl -s -X POST http://localhost:3100/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"you@school.edu","password":"yourpassword"}' \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

   # Find your user id, then promote
   curl -s http://localhost:3100/api/auth/users -H "Authorization: Bearer $TOKEN"
   curl -s -X PATCH http://localhost:3100/api/auth/users/<YOUR_ID>/role \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"role":"admin"}'
   ```

   (A teacher cannot call the admin endpoints — they return 403. If you are
   stuck with no admin at all, set `role: admin` in the `auth_users` table
   directly, then re-login.)

   A simpler path: register the *first* account you create with the admin
   flag by calling the register endpoint with `"role":"admin"`:

   ```bash
   curl -s -X POST http://localhost:3100/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@school.edu","password":"...","role":"admin"}'
   ```

## Data & persistence

All data lives in named Docker volumes and survives `npm run stop`:

| Volume          | Holds                                        |
|-----------------|----------------------------------------------|
| `postgres-data` | All app data (students, curricula, feedback, auth). |
| `rustfs-data`   | Uploaded curriculum files.                   |
| `ollama-data`   | Downloaded Ollama models.                    |

To back up, export the database:

```bash
docker exec hackgb-postgres pg_dump -U hackgb hackgb > backup.sql
```

To start completely fresh (this **deletes all data**):

```bash
npm run stop
sudo docker volume rm hackgbcurriculumplanningassistant_postgres-data \
  hackgbcurriculumplanningassistant_rustfs-data \
  hackgbcurriculumplanningassistant_ollama-data
npm run start
```

## Security notes

- Set a strong `AUTH_JWT_SECRET` and change the default Postgres/RustFS
  passwords in `docker-compose.yml` before exposing the app on a network.
- The app is meant to be run behind your school's network or a reverse proxy
  (e.g. Caddy/Traefik) with TLS for internet access.
- Role-based access control: teachers see only their own students and data;
  admins can manage accounts. Unauthenticated requests are rejected (401)
  and role-escalation attempts are blocked (403).

## Troubleshooting

- **Backend not responding on start** — `npm run logs` and check the backend
  logs. The most common cause is the database not being ready yet; `npm run
  start` already waits for the healthy state.
- **Suggestions fail with “model not found”** — pull the Ollama models (see
  “Load a model into Ollama”).
- **Frontend shows “Backend unavailable”** — the frontend talks to the
  backend over the port it was built with. If the backend port changed,
  re-run `npm run start` (it rebuilds the frontend with the new URL).
- **Login works but pages redirect to /login** — the token expired (7 days)
  or was cleared; sign in again.

## Development

```bash
# Run backend + frontend in dev mode (no Docker) — requires a local Postgres
# and RustFS, or point env vars at a running stack.
npm run dev:backend   # NestJS on :3001
npm run dev:frontend  # Next.js on :3000

# Unit tests (backend)
npm test

# E2E tests (backend) — require the Docker stack running:
npm run test:e2e --workspace=backend
```

---

# Project Development Notes

The original project outline, requirements, and production plan that guided
this build.

## Project Requirements — Personalized Curriculum Assistant

Core Concept: Web-based app to assist teachers in developing personalized
curricula. The teacher always decides what gets taught and does the actual
teaching; the assistant provides suggestions and options.

### Core Features

1. **Curriculum Import**
   - Teacher uploads curriculum files to the assistant's database
   - Supports PDF, Word, and Google Docs
   - Syncs with Google Classroom and Canvas
   - Supports SCORM/xAPI standards

2. **Student Academic Profiles**
   - Teacher creates an academic profile for each student
   - Tracks progress, skills, reading level, math ability, and more
   - Multi-modal progress tracking: IEP/504 plans, ELL status,
     learning differences, and social-emotional notes

3. **LLM Integration**
   - Connect either a local or cloud LLM model

4. **Personalized Lesson Suggestions**
   - LLM reviews student data against curriculum goals
   - Generates lesson plan options and individualized support suggestions
   - Teacher reviews, modifies, or rejects suggestions

5. **Resource Generation (OPTIONAL — teacher-initiated)**
   - Can generate worksheets, readings, practice problems, etc.
   - NOT generated automatically — significantly slower
   - Teacher explicitly requests it when they want it
   - Disabled by default

6. **Teacher Feedback System**
   - All feedback from the teacher is stored in the system
   - Teachers can edit, update, or delete their feedback at any time
   - Stored feedback directly guides the model's future suggestions
   - When a teacher rejects or modifies a suggestion, the reason is
     captured and used to improve subsequent recommendations
   - This creates a human-in-the-loop learning system where the model
     gets better over time as the teacher refines its understanding

7. **Progress Dashboards**
   - Per-student timelines showing skill mastery and growth over time
   - Per-class timelines for overall class progress
   - Visual dashboards for teachers to quickly assess where students are

8. **Multi-language Support**
   - UI available in multiple languages
   - Generated content (lesson plans, suggestions, resources)
     supports multiple languages

### Technical Architecture

Stack: Full TypeScript (frontend + backend)

**Frontend**
- Next.js (React) — Single-Page App with SSR
- Dashboard-heavy UI for profiles, timelines, suggestions
- i18n support for multi-language UI

**Backend**
- Node.js + NestJS (TypeScript)
- REST/GraphQL API
- Modular architecture: curriculum, students, llm, feedback,
  dashboards as distinct modules

**Database**
- PostgreSQL + pgvector
  - Structured data: student profiles, skills, progress,
    feedback, lesson plans, curriculum metadata
  - Vector embeddings: curriculum chunks for RAG
- Single database for both relational and vector data

**File Storage**
- RustFS (self-hosted S3-compatible) for uploaded documents
  [MinIO was archived Apr 2026; its Docker images are no longer published]
- Local filesystem option for single-server deployments

**LLM Integration**
- Custom LLM Gateway (adapter pattern)
  - Abstracts provider behind a single interface
  - Implementations: OpenAI, Anthropic, Ollama (local)
  - Swap models via config, no code changes
- Local model deployment:
  - Ollama for initial development
  - vLLM for production / higher throughput
- Embedding models:
  - Local: nomic-embed-text or mxbai-embed-large
  - Cloud: OpenAI text-embedding-3-small

**Curriculum Processing Pipeline**

Upload -> Parse -> Text Extraction -> Chunking ->
Embedding -> pgvector (RAG for LLM queries)

Parsing:
- PDF: pdf-parse or pdfjs
- Word: mammoth.js
- Google Docs: Google Docs API
- Normalization: consistent markdown output

**Feedback Loop**
- Each LLM suggestion gets a unique ID
- Teacher feedback (accept/modify/reject + reason)
  tied to suggestion ID
- Before each LLM call, system retrieves relevant
  past feedback via pgvector similarity search
- Retrieved feedback injected into system prompt
- Feedback is editable by teacher; edits update
  stored version used in future prompts
- Recency weighting: recent feedback weighted
  more heavily than older feedback

**Authentication**
- NextAuth.js for initial implementation
- Role-based access: teacher, admin
- Multi-tenant capable (school-level isolation)

**Deployment**
- Docker Compose for single-server, self-hosted deployment
- Services: frontend, backend, PostgreSQL, RustFS, Ollama
- Privacy-first: student data stays on school's infrastructure
- Cloud deployment as an option for non-privacy-sensitive use

### Optional Features (if time allows)

- Collaborative planning (multiple teachers of same subject)
- Admin view for department heads/principals (school-level curriculum
  coverage, no individual student data)
- Export to LMS (Canvas, Google Classroom, Moodle)
- Offline/lightweight mode for poor connectivity
- Guardian/parent communication and progress summaries
- Student self-assessment input
- Standards gap analysis and intervention planning
- Small-group grouping suggestions
- Formative check-in generation (exit tickets, quizzes)
- Time-aware scheduling (class period length, weekly calendar)
- Learning objective tagging with standards alignment
  (Common Core, state standards)
- Curriculum versioning, sharing, and reuse
- Privacy-first architecture (FERPA/COPPA compliance, data
  minimization, role-based access, audit logs)

## Production Plan — Build Order

Each chunk is independently testable and builds on the previous ones. No
chunk depends on an untested prior chunk.

### Chunk 1: Project Scaffolding
**What:**
- Repo setup, monorepo structure (Next.js frontend + NestJS backend)
- Docker Compose file
- Environment config
- Basic "hello world" health check endpoint

**How to test:**
- `docker compose up` brings up all services
- Frontend loads in browser
- `GET /api/health` returns 200
- No errors in any service logs

**Deliverable:** Working skeleton where features can be added without touching
the foundation.

### Chunk 2: Database Layer (PostgreSQL + pgvector)
**What:**
- Database migrations/schema for all entities (students, curriculum,
  feedback, suggestions)
- pgvector extension
- Basic CRUD repositories

**How to test:**
- Migrations run cleanly on a fresh DB
- Unit tests: create/read/update/delete for each entity
- Verify pgvector is working: insert a vector, do a similarity search

**Deliverable:** Tested data layer that everything else builds on.

### Chunk 3: File Storage + Curriculum Parsing
**What:**
- RustFS integration (upload/download) [MinIO was archived Apr 2026;
  its Docker images are no longer published, so RustFS is the S3-compatible
  drop-in]
- File parsers for PDF/Word/Docs
- Text extraction
- Chunking
- Embedding generation
- Storage to pgvector

**How to test:**
- Upload a test PDF, verify it is stored in RustFS
- Parse a sample PDF, verify extracted text is correct
- Chunk a document, verify chunk size/overlap
- Embed a chunk, verify vector is stored in pgvector
- Round-trip: upload -> parse -> chunk -> embed -> retrieve
  by similarity

**Deliverable:** Teachers can upload curricula and the system processes them
into searchable chunks.

### Chunk 4: LLM Gateway
**What:**
- Adapter pattern implementation
- Single interface with OpenAI, Anthropic, and Ollama adapters
- Config-driven model selection
- Basic chat completion and embedding endpoints

**How to test:**
- Unit tests with mock adapters (no real API calls)
- Integration test: call Ollama locally with a simple prompt,
  verify response
- Integration test: switch config to OpenAI, verify same
  interface works
- Test error handling: bad API key, model not found, timeout

**Deliverable:** Swappable LLM provider behind one interface, tested with
both local and cloud.

### Chunk 5: RAG Pipeline
**What:**
- Retrieval-augmented generation flow
- Given a query, retrieve relevant curriculum chunks from
  pgvector
- Build context, call LLM gateway, return grounded response

**How to test:**
- Given a test curriculum, ask a question, verify the answer
  is grounded in the retrieved chunks
- Verify retrieval returns relevant chunks (not random ones)
- Test with multiple curricula, verify it pulls from the right
  one
- Test edge cases: no relevant chunks, ambiguous query

**Deliverable:** The core "brain" of the app. LLM can answer questions about
uploaded curricula.

### Chunk 6: Student Profiles
**What:**
- Full CRUD for student profiles
- Multi-modal tracking: reading level, math ability, IEP/504,
  ELL, learning differences, social-emotional notes
- Progress timeline entries

**How to test:**
- Create a student with all profile fields
- Update progress over time, verify timeline entries
- Query by reading level, by skill, by learning difference
- Verify data isolation (teacher A cannot see teacher B's
  students)

**Deliverable:** Teachers can manage rich student profiles.

### Chunk 7: Personalized Lesson Suggestions
**What:**
- Combine student profile + curriculum goals + RAG context +
  past feedback
- LLM generates lesson plan options

**How to test:**
- Given a student profile + a curriculum, generate suggestions,
  verify they are relevant to the student's level
- Verify different students at different levels get different
  suggestions
- Verify the response includes multiple options
- Test with empty profile (edge case)

**Deliverable:** The main value proposition works end-to-end.

### Chunk 8: Teacher Feedback Loop
**What:**
- Suggestion IDs
- Feedback storage (accept/modify/reject + reason)
- pgvector similarity search for relevant past feedback
- Feedback injection into LLM prompts
- Feedback editing

**How to test:**
- Generate a suggestion, teacher rejects it with reason,
  verify feedback is stored
- Generate a new suggestion, verify the rejected feedback
  influenced the response
- Edit a past feedback, verify the updated version is used in
  future prompts
- Test recency weighting (older feedback has less influence)
- Test with no prior feedback (first-time teacher)

**Deliverable:** The model gets smarter per-teacher over time, and teachers
control the learning.

### Chunk 9: Progress Dashboards
**What:**
- Per-student timelines
- Per-class timelines
- Visual charts showing skill mastery over time

**How to test:**
- Student with 5 progress entries, verify timeline shows all
  5 in order
- Class with 20 students, verify class-level aggregation is
  correct
- Verify charts render with correct data
- Test with a new student (no data yet)

**Deliverable:** Teachers can visualize where students are at a glance.

### Chunk 10: Multi-language Support
**What:**
- i18n for UI (at least English + one other)
- LLM prompt engineering for multi-language content generation

**How to test:**
- Switch UI language, verify all strings translate
- Request a lesson plan in Spanish, verify content is in
  Spanish
- Verify UI and content language can differ independently

**Deliverable:** App is usable by non-English-speaking teachers.

### Chunk 11: Authentication & Roles
**What:**
- NextAuth integration
- Login/logout
- Role-based access (teacher, admin)
- Session management

**How to test:**
- Register/login/logout flow
- Teacher can access their own data only
- Admin can access school-wide data
- Unauthenticated requests are rejected
- Role escalation attempts are blocked

**Deliverable:** Secure access control.

### Chunk 12: Resource Generation (Optional, Teacher-Initiated)
**What:**
- Slow generation path: worksheets, readings, practice problems
- Explicitly triggered by teacher
- Progress indicators during generation

**How to test:**
- Request resource generation, verify it is not triggered
  automatically
- Verify progress indicator updates during generation
- Verify generated resource is relevant to the student
- Test timeout handling for long generations

**Deliverable:** Teachers can opt into deep resource generation when they want
it.

### Chunk 13: Docker Compose + Deployment
**What:**
- Finalize Docker Compose
- Environment variable management
- Health checks
- Volume persistence
- Documentation

**How to test:**
- Fresh `docker compose up` on a clean machine, everything works
- Data persists across restarts
- All services have health checks
- Deployment docs are clear enough for a non-developer to
  follow

**Deliverable:** A self-hostable, production-ready package.

### Testing Strategy
- **Unit tests:** Every chunk — services, repositories, adapters
- **Integration tests:** Chunks 3, 4, 5, 7, 8 — real DB, real LLM (or mock)
- **API tests:** Every chunk that has endpoints
- **E2E tests:** Chunk 7 (core flow), Chunk 13 (full deployment)

### Key Principle
Each chunk ends with a working, testable increment. You never have
a chunk that depends on an untested prior chunk. If Chunk 4
(LLM Gateway) has a bug, it will not silently break Chunk 7
(Suggestions) — the integration tests will catch it.

## AI Disclosure
Entire project was programmed by Qwen3.8-27B running on local hardware (V100).
Outline and development goals were provided through text files that were
developed mainly by me with assistance from Qwen.
