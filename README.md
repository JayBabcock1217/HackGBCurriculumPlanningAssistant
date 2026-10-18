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
