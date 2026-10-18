# HackGBCurriculumPlanningAssistant
An application designed to assist teachers in recording student progress in comparison to their curriculums expectations, and create individualized lesson plans to meet each student's needs.

Project Requirements - Personalized Curriculum Assistant
=========================================================

Core Concept: Web-based app to assist teachers in developing personalized
curricula. The teacher always decides what gets taught and does the actual
teaching; the assistant provides suggestions and options.

Core Features
-------------
1. Curriculum Import
   - Teacher uploads curriculum files to the assistant's database
   - Supports PDF, Word, and Google Docs
   - Syncs with Google Classroom and Canvas
   - Supports SCORM/xAPI standards

2. Student Academic Profiles
   - Teacher creates an academic profile for each student
   - Tracks progress, skills, reading level, math ability, and more
   - Multi-modal progress tracking: IEP/504 plans, ELL status,
     learning differences, and social-emotional notes

3. LLM Integration
   - Connect either a local or cloud LLM model

4. Personalized Lesson Suggestions
   - LLM reviews student data against curriculum goals
   - Generates lesson plan options and individualized support suggestions
   - Teacher reviews, modifies, or rejects suggestions

5. Resource Generation (OPTIONAL - teacher-initiated)
   - Can generate worksheets, readings, practice problems, etc.
   - NOT generated automatically - significantly slower
   - Teacher explicitly requests it when they want it
   - Disabled by default

6. Teacher Feedback System
   - All feedback from the teacher is stored in the system
   - Teachers can edit, update, or delete their feedback at any time
   - Stored feedback directly guides the model's future suggestions
   - When a teacher rejects or modifies a suggestion, the reason is
     captured and used to improve subsequent recommendations
   - This creates a human-in-the-loop learning system where the model
     gets better over time as the teacher refines its understanding

7. Progress Dashboards
   - Per-student timelines showing skill mastery and growth over time
   - Per-class timelines for overall class progress
   - Visual dashboards for teachers to quickly assess where students are

8. Multi-language Support
   - UI available in multiple languages
   - Generated content (lesson plans, suggestions, resources)
     supports multiple languages

Technical Architecture
----------------------
Stack: Full TypeScript (frontend + backend)

Frontend
--------
- Next.js (React) - Single-Page App with SSR
- Dashboard-heavy UI for profiles, timelines, suggestions
- i18n support for multi-language UI

Backend
-------
- Node.js + NestJS (TypeScript)
- REST/GraphQL API
- Modular architecture: curriculum, students, llm, feedback,
  dashboards as distinct modules

Database
--------
- PostgreSQL + pgvector
  * Structured data: student profiles, skills, progress,
    feedback, lesson plans, curriculum metadata
  * Vector embeddings: curriculum chunks for RAG
- Single database for both relational and vector data

File Storage
------------
- RustFS (self-hosted S3-compatible) for uploaded documents
  [MinIO was archived Apr 2026; its Docker images are no longer published]
- Local filesystem option for single-server deployments

LLM Integration
---------------
- Custom LLM Gateway (adapter pattern)
  * Abstracts provider behind a single interface
  * Implementations: OpenAI, Anthropic, Ollama (local)
  * Swap models via config, no code changes
- Local model deployment:
  * Ollama for initial development
  * vLLM for production / higher throughput
- Embedding models:
  * Local: nomic-embed-text or mxbai-embed-large
  * Cloud: OpenAI text-embedding-3-small

Curriculum Processing Pipeline
------------------------------
Upload -> Parse -> Text Extraction -> Chunking ->
Embedding -> pgvector (RAG for LLM queries)

Parsing:
- PDF: pdf-parse or pdfjs
- Word: mammoth.js
- Google Docs: Google Docs API
- Normalization: consistent markdown output

Feedback Loop
-------------
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

Authentication
--------------
- NextAuth.js for initial implementation
- Role-based access: teacher, admin
- Multi-tenant capable (school-level isolation)

Deployment
----------
- Docker Compose for single-server, self-hosted deployment
- Services: frontend, backend, PostgreSQL, RustFS, Ollama
- Privacy-first: student data stays on school's infrastructure
- Cloud deployment as an option for non-privacy-sensitive use

Optional Features (if time allows)
----------------------------------
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

Production Plan - Personalized Curriculum Assistant
====================================================

Build order: Each chunk is independently testable and builds on the
previous ones. No chunk depends on an untested prior chunk.

Chunk 1: Project Scaffolding
-----------------------------
What:
  - Repo setup, monorepo structure (Next.js frontend + NestJS backend)
  - Docker Compose file
  - Environment config
  - Basic "hello world" health check endpoint

How to test:
  - docker compose up brings up all services
  - Frontend loads in browser
  - GET /api/health returns 200
  - No errors in any service logs

Deliverable:
  Working skeleton where features can be added without touching
  the foundation.

Chunk 2: Database Layer (PostgreSQL + pgvector)
------------------------------------------------
What:
  - Database migrations/schema for all entities (students, curriculum,
    feedback, suggestions)
  - pgvector extension
  - Basic CRUD repositories

How to test:
  - Migrations run cleanly on a fresh DB
  - Unit tests: create/read/update/delete for each entity
  - Verify pgvector is working: insert a vector, do a similarity search

Deliverable:
  Tested data layer that everything else builds on.

Chunk 3: File Storage + Curriculum Parsing
-------------------------------------------
What:
  - RustFS integration (upload/download) [MinIO was archived Apr 2026;
    its Docker images are no longer published, so RustFS is the S3-compatible
    drop-in]
  - File parsers for PDF/Word/Docs
  - Text extraction
  - Chunking
  - Embedding generation
  - Storage to pgvector

How to test:
  - Upload a test PDF, verify it is stored in RustFS
  - Parse a sample PDF, verify extracted text is correct
  - Chunk a document, verify chunk size/overlap
  - Embed a chunk, verify vector is stored in pgvector
  - Round-trip: upload -> parse -> chunk -> embed -> retrieve
    by similarity

Deliverable:
  Teachers can upload curricula and the system processes them into
  searchable chunks.

Chunk 4: LLM Gateway
---------------------
What:
  - Adapter pattern implementation
  - Single interface with OpenAI, Anthropic, and Ollama adapters
  - Config-driven model selection
  - Basic chat completion and embedding endpoints

How to test:
  - Unit tests with mock adapters (no real API calls)
  - Integration test: call Ollama locally with a simple prompt,
    verify response
  - Integration test: switch config to OpenAI, verify same
    interface works
  - Test error handling: bad API key, model not found, timeout

Deliverable:
  Swappable LLM provider behind one interface, tested with both
  local and cloud.

Chunk 5: RAG Pipeline
----------------------
What:
  - Retrieval-augmented generation flow
  - Given a query, retrieve relevant curriculum chunks from
    pgvector
  - Build context, call LLM gateway, return grounded response

How to test:
  - Given a test curriculum, ask a question, verify the answer
    is grounded in the retrieved chunks
  - Verify retrieval returns relevant chunks (not random ones)
  - Test with multiple curricula, verify it pulls from the right
    one
  - Test edge cases: no relevant chunks, ambiguous query

Deliverable:
  The core "brain" of the app. LLM can answer questions about
  uploaded curricula.

Chunk 6: Student Profiles
--------------------------
What:
  - Full CRUD for student profiles
  - Multi-modal tracking: reading level, math ability, IEP/504,
    ELL, learning differences, social-emotional notes
  - Progress timeline entries

How to test:
  - Create a student with all profile fields
  - Update progress over time, verify timeline entries
  - Query by reading level, by skill, by learning difference
  - Verify data isolation (teacher A cannot see teacher B's
    students)

Deliverable:
  Teachers can manage rich student profiles.

Chunk 7: Personalized Lesson Suggestions
-----------------------------------------
What:
  - Combine student profile + curriculum goals + RAG context +
    past feedback
  - LLM generates lesson plan options

How to test:
  - Given a student profile + a curriculum, generate suggestions,
    verify they are relevant to the student's level
  - Verify different students at different levels get different
    suggestions
  - Verify the response includes multiple options
  - Test with empty profile (edge case)

Deliverable:
  The main value proposition works end-to-end.

Chunk 8: Teacher Feedback Loop
-------------------------------
What:
  - Suggestion IDs
  - Feedback storage (accept/modify/reject + reason)
  - pgvector similarity search for relevant past feedback
  - Feedback injection into LLM prompts
  - Feedback editing

How to test:
  - Generate a suggestion, teacher rejects it with reason,
    verify feedback is stored
  - Generate a new suggestion, verify the rejected feedback
    influenced the response
  - Edit a past feedback, verify the updated version is used in
    future prompts
  - Test recency weighting (older feedback has less influence)
  - Test with no prior feedback (first-time teacher)

Deliverable:
  The model gets smarter per-teacher over time, and teachers
  control the learning.

Chunk 9: Progress Dashboards
-----------------------------
What:
  - Per-student timelines
  - Per-class timelines
  - Visual charts showing skill mastery over time

How to test:
  - Student with 5 progress entries, verify timeline shows all
    5 in order
  - Class with 20 students, verify class-level aggregation is
    correct
  - Verify charts render with correct data
  - Test with a new student (no data yet)

Deliverable:
  Teachers can visualize where students are at a glance.

Chunk 10: Multi-language Support
---------------------------------
What:
  - i18n for UI (at least English + one other)
  - LLM prompt engineering for multi-language content generation

How to test:
  - Switch UI language, verify all strings translate
  - Request a lesson plan in Spanish, verify content is in
    Spanish
  - Verify UI and content language can differ independently

Deliverable:
  App is usable by non-English-speaking teachers.

Chunk 11: Authentication & Roles
---------------------------------
What:
  - NextAuth integration
  - Login/logout
  - Role-based access (teacher, admin)
  - Session management

How to test:
  - Register/login/logout flow
  - Teacher can access their own data only
  - Admin can access school-wide data
  - Unauthenticated requests are rejected
  - Role escalation attempts are blocked

Deliverable:
  Secure access control.

Chunk 12: Resource Generation (Optional, Teacher-Initiated)
------------------------------------------------------------
What:
  - Slow generation path: worksheets, readings, practice problems
  - Explicitly triggered by teacher
  - Progress indicators during generation

How to test:
  - Request resource generation, verify it is not triggered
    automatically
  - Verify progress indicator updates during generation
  - Verify generated resource is relevant to the student
  - Test timeout handling for long generations

Deliverable:
  Teachers can opt into deep resource generation when they want
  it.

Chunk 13: Docker Compose + Deployment
--------------------------------------
What:
  - Finalize Docker Compose
  - Environment variable management
  - Health checks
  - Volume persistence
  - Documentation

How to test:
  - Fresh docker compose up on a clean machine, everything works
  - Data persists across restarts
  - All services have health checks
  - Deployment docs are clear enough for a non-developer to
    follow

Deliverable:
  A self-hostable, production-ready package.

Testing Strategy
----------------
Unit tests:        Every chunk - services, repositories, adapters
Integration tests: Chunks 3, 4, 5, 7, 8 - real DB, real LLM (or mock)
API tests:         Every chunk that has endpoints
E2E tests:         Chunk 7 (core flow), Chunk 13 (full deployment)

Key Principle
-------------
Each chunk ends with a working, testable increment. You never have
a chunk that depends on an untested prior chunk. If Chunk 4
(LLM Gateway) has a bug, it will not silently break Chunk 7
(Suggestions) - the integration tests will catch it.


# AI Disclosure
Entire project was programmed by Qwen3.8-27B running on local hardware (V100). Outline and development goals were provided through text files that were devloped mainly by me with assistance from Qwen.
