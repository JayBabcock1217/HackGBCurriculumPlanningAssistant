import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StudentService } from '../database/student/student.service';
import { CurriculumService } from '../database/curriculum/curriculum.service';
import { SuggestionService } from '../database/suggestion/suggestion.service';
import { RagService } from '../rag/rag.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { FeedbackService } from '../database/feedback/feedback.service';
import { Student } from '../database/student/student.entity';
import { Curriculum } from '../database/curriculum/curriculum.entity';
import { getActivityType } from './activity-types';
import {
  ResourceDocument,
  toResourceDocument,
} from './document-schema';
import { docToPlainText } from './document-renderer';

/**
 * The structured document is persisted as a plain JSON object in the
 * suggestion's jsonb `details.document` column. Type it as a record so it
 * round-trips through TypeORM without index-signature complaints.
 */
type DocumentJson = Record<string, unknown>;

export interface GenerateSuggestionsOptions {
  studentId: string;
  curriculumId: string;
  /** Number of distinct options to generate (default 3, max 5). */
  optionCount?: number;
  /** Optional focus/ask from the teacher, e.g. "focus on regrouping". */
  focus?: string;
  maxTokens?: number;
  /**
   * Chunk 10: language the generated CONTENT should be written in (e.g.
   * "Spanish"). The UI language is a separate, independent setting — only the
   * lesson/plan content itself is translated when this is set.
   */
  language?: string;
  /**
   * Chunk 12: the resource type being generated (worksheet/reading/practice).
   * Stored on the job row so the UI can show a label while waiting.
   */
  kind?: string;
  /**
   * Lesson/activity type for the Resources generator (guided_lesson,
   * worksheet, reading, practice, assessment, project, game, intervention).
   * When set, a single, complete artifact of that type is generated.
   */
  activityType?: string;
}

export interface LessonOption {
  title: string;
  type: 'lesson_plan' | 'activity' | 'assessment' | 'intervention' | 'resource';
  summary: string;
  content: string;
  /**
   * Structured document (Resources generator). When present, the UI renders it
   * and the /documents/:id endpoint can export it as HTML/DOCX/PDF. Legacy
   * suggestion options have no document and rely on `content` only.
   */
  document?: ResourceDocument;
}

export interface SuggestionSource {
  chunkId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  curriculumId: string;
}

/**
 * Chunk 12: a compact source reference persisted on a background job row.
 * The full SuggestionSource (with chunk text) is returned by the synchronous
 * /generate path; the job only needs chunkId + similarity for display.
 */
export interface JobSource {
  chunkId: string;
  similarity: number;
}

export interface GenerateSuggestionsResult {
  studentId: string;
  curriculumId: string;
  options: LessonOption[];
  /**
   * Synchronous /generate returns full SuggestionSource objects; the
   * background status endpoint returns the compact JobSource shape (chunkId +
   * similarity only). Both are acceptable.
   */
  sources: Array<SuggestionSource | JobSource>;
  model: string;
  /**
   * Chunk 12: present on background-job status responses.
   *  - 'generating' — the LLM is still working (options is empty).
   *  - 'pending'    — complete; options[0] is the finished resource.
   *  - 'failed'     — errored; see `error`.
   * Omitted for the synchronous /generate path (always complete).
   */
  status?: 'generating' | 'pending' | 'failed';
  /** The background job id (suggestion row) for status polling. */
  jobId?: string;
  /** Present when status === 'failed'. */
  error?: string;
}

/**
 * SuggestionGeneratorService (Chunk 7)
 *
 * The core value proposition: combine a student's profile + curriculum goals
 * + RAG context (retrieved chunks) and have the LLM generate multiple
 * personalized lesson options the teacher can choose from.
 *
 * Pipeline:
 *   1. Load student profile + curriculum
 *   2. Retrieve relevant curriculum chunks (RAG retrieval)
 *   3. Build a structured prompt with student context + chunk context
 *   4. LLM generates N options as strict JSON
 *   5. Persist each option as a Suggestion record (status: pending)
 */
@Injectable()
export class SuggestionGeneratorService {
  private readonly logger = new Logger(SuggestionGeneratorService.name);

  constructor(
    private readonly studentService: StudentService,
    private readonly curriculumService: CurriculumService,
    private readonly suggestionService: SuggestionService,
    private readonly rag: RagService,
    private readonly gateway: LlmGatewayService,
    private readonly feedbackService: FeedbackService,
  ) {}

  /**
   * Chunk 12: start a background resource-generation job and return its id
   * immediately. The LLM work runs detached from the HTTP request (see
   * `runJob`), so the teacher can navigate away and come back; progress and
   * the finished resource are persisted in the database and reloaded via the
   * status endpoint.
   */
  async startJob(options: GenerateSuggestionsOptions, ownerId?: string): Promise<string> {
    const job = await this.suggestionService.createPendingJob({
      studentId: options.studentId,
      curriculumId: options.curriculumId,
      ownerId,
      focus: options.focus,
      kind: options.kind,
      details: options.activityType ? { activityType: options.activityType } : undefined,
    });
    // Detach from the request lifecycle: don't await, and swallow rejections
    // (runJob records them on the job row) so the HTTP response has already
    // been sent by the time the LLM work completes or fails.
    void this.runJob(job.id, options, ownerId).catch((e) =>
      this.logger.error(
        `Background job ${job.id} crashed: ${e instanceof Error ? e.stack : e}`,
      ),
    );
    return job.id;
  }

  /**
   * Chunk 12: read the current state of a background generation job. Throws
   * 404 if the job does not exist or belongs to a different user.
   */
  async jobStatus(id: string, ownerId?: string): Promise<GenerateSuggestionsResult> {
    const job = await this.suggestionService.findOne(id);
    if (ownerId && job.ownerId && job.ownerId !== ownerId) {
      throw new BadRequestException('Not your generation');
    }
    const d = (job.details as Record<string, unknown>) || {};
    const doc =
      d.document && typeof d.document === 'object'
        ? toResourceDocument(d.document as any)
        : null;
    const opt: LessonOption = {
      title: job.title || 'Generated resource',
      type: (job.type as LessonOption['type']) || 'resource',
      summary: String(d.summary || ''),
      content: job.content,
      document: doc || undefined,
    };
    return {
      studentId: job.student?.id,
      curriculumId: job.curriculum?.id,
      status: job.status as GenerateSuggestionsResult['status'],
      jobId: job.id,
      options: job.status === 'pending' ? [opt] : [],
      sources: Array.isArray(d.sources)
        ? (d.sources as JobSource[])
        : [],
      model: job.modelUsed || '',
      error: d.error ? String(d.error) : undefined,
    };
  }

  /**
   * Chunk 12: the actual LLM pipeline, executed in the background and writing
   * its outcome back to the job row. On success the row becomes a normal
   * 'pending' suggestion (visible on the Suggestions page); on failure it is
   * marked 'failed' with a message the UI can surface.
   */
  private async runJob(
    jobId: string,
    options: GenerateSuggestionsOptions,
    ownerId?: string,
  ): Promise<void> {
    try {
      const result = await this.generate(options);
      const opt = result.options[0];
      const sources = (result.sources || []).map((s) => ({
        chunkId: s.chunkId,
        similarity: s.similarity,
      }));
      await this.suggestionService.resolveJob(jobId, {
        type: opt?.type,
        title: opt?.title || 'Generated resource',
        content: opt?.content || '',
        summary: opt?.summary,
        modelUsed: result.model,
        sources,
        document: opt?.document as DocumentJson | undefined,
      });
      this.logger.log(`Background job ${jobId} completed`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Background job ${jobId} failed: ${message}`);
      await this.suggestionService
        .resolveJob(jobId, { type: 'resource', title: 'Generation failed', content: '', status: 'failed', error: message })
        .catch(() => undefined);
    }
  }

  async generate(options: GenerateSuggestionsOptions): Promise<GenerateSuggestionsResult> {
    const optionCount = Math.min(Math.max(options.optionCount ?? 3, 1), 5);

    // 1. Load inputs
    const student = await this.studentService.findOne(options.studentId);
    const curriculum = await this.curriculumService.findOne(options.curriculumId);

    if (!student || !curriculum) {
      throw new BadRequestException('Student or curriculum not found');
    }

    // Resources path: a single, complete artifact of a specific
    // lesson/activity type (guided_lesson, worksheet, reading, ...). Uses the
    // same RAG retrieval + student context, but a dedicated prompt tuned to
    // produce a legitimate, classroom-ready artifact.
    if (options.activityType) {
      return this.generateActivity(options, student, curriculum);
    }

    // 2. Retrieve relevant curriculum chunks for this student + curriculum
    const query = this.buildRetrievalQuery(student, curriculum, options.focus);
    const sources = await this.rag.retrieve(query, {
      curriculumId: curriculum.id,
      topK: 6,
      minSimilarity: 0.15,
    });

    // 2b. Chunk 8: retrieve the teacher's most relevant past feedback so the
    //     model gets smarter per-teacher. Embed the same retrieval query used
    //     for chunks, then rank by similarity + recency. Wrapped in try/catch
    //     so a feedback failure never blocks suggestion generation.
    const teacherId = student.teacher?.id;
    const pastFeedback: Array<{
      action: string;
      reason?: string;
      teacherComment?: string;
      modifiedContent?: string;
      weight: number;
    }> = [];
    if (teacherId) {
      try {
        const { embedding } = await this.gateway.embed(query);
        const relevant = await this.feedbackService.findRelevant(teacherId, embedding, {
          limit: 5,
        });
        for (const fb of relevant) {
          pastFeedback.push({
            action: fb.action,
            reason: fb.reason,
            teacherComment: fb.teacherComment,
            modifiedContent: fb.modifiedContent,
            weight: fb.weight,
          });
        }
      } catch (e) {
        this.logger.warn(
          `Feedback retrieval failed (continuing without it): ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    // 3. Build the prompt
    const systemContext = this.buildStudentContext(student);
    const contextBlocks = sources.length
      ? sources
          .map(
            (s, i) =>
              `[Source ${i + 1}] (curriculum chunk, similarity ${s.similarity})\n${s.content}`,
          )
          .join('\n\n---\n\n')
      : 'No curriculum chunks were retrieved. Base the options on the curriculum title/subject and the student profile, and label them as general best-practice suggestions.';
    const feedbackBlock = this.buildFeedbackBlock(pastFeedback);

    const prompt = `You are an expert K-12 curriculum planning assistant. Generate exactly ${optionCount} DISTINCT, personalized lesson plan options for this student, grounded in the curriculum context below.

STUDENT PROFILE:
${systemContext}

CURRICULUM:
- Title: ${curriculum.title}
- Subject: ${curriculum.subject || 'Unknown'}
- Grade level: ${curriculum.gradeLevel || 'Unknown'}
${options.focus ? `- Teacher focus: ${options.focus}` : ''}
${options.language ? `\nOUTPUT LANGUAGE: Write ALL option content (title, summary, and the full lesson content) in ${options.language}. Keep the JSON structure and keys in English, but translate the human-readable values into ${options.language}.` : ''}

CURRICULUM CONTEXT (retrieved chunks):
${contextBlocks}

TEACHER'S PAST FEEDBACK (learn from these — higher weight = more recent/relevant):
${feedbackBlock}

REQUIREMENTS:
- Each option must be tailored to THIS student's level, learning differences, language status, and notes.
- If the teacher's past feedback shows they rejected or modified a similar approach, AVOID repeating the rejected approach and apply the lesson from the modification/comment. Incorporate what they accepted.
- Options should be meaningfully different from each other (different approach, activity type, or scaffolding).
- Use the curriculum context to align objectives and content. Cite sources as [1], [2] where relevant.
- If the student has an IEP/504 or is an ELL, explicitly incorporate appropriate accommodations.
- If a student field is missing, make a reasonable assumption and note it in the option.

Respond with STRICT JSON only — no markdown, no code fences, no text outside the JSON. Use exactly this shape:
{
  "options": [
    {
      "title": "short descriptive title",
      "type": "lesson_plan | activity | assessment | intervention | resource",
      "summary": "1-2 sentence overview",
      "content": "Full lesson plan: objectives, materials, step-by-step procedure (numbered), differentiation/accommodations, assessment/check-for-understanding."
    }
  ]
}`;

    // 4. Generate via LLM (RAG was used for retrieval above). Small models can
    //    occasionally emit malformed JSON, so we retry once before giving up.
    const messages = [
      {
        role: 'system' as const,
        content: 'You output strict JSON only. Never include markdown or commentary.',
      },
      { role: 'user' as const, content: prompt },
    ];
    const chatOpts = { maxTokens: options.maxTokens ?? 4000, temperature: 0.4 };

    let parsed: { options: LessonOption[]; model: string } | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.gateway.chat(messages, chatOpts);
      try {
        parsed = this.parseOptionsJson(raw.content, optionCount, raw.model);
        break;
      } catch (e) {
        lastError = e;
        this.logger.warn(
          `Attempt ${attempt + 1} failed to parse options JSON; ${attempt === 0 ? 'retrying' : 'giving up'}`,
        );
      }
    }
    if (!parsed) {
      throw lastError instanceof BadRequestException
        ? lastError
        : new BadRequestException('The model did not return valid options. Please try again.');
    }

    // 6. Persist each option. All options from the same generation share a
    //    generationId so the UI can group them as one "set of options".
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const saved: LessonOption[] = [];
    for (const opt of parsed.options) {
      await this.suggestionService.create({
        type: opt.type,
        content: opt.content,
        title: opt.title,
        details: {
          summary: opt.summary,
          generationId,
          sources: sources.map((s) => ({
            chunkId: s.chunkId,
            similarity: s.similarity,
          })),
          focus: options.focus,
          language: options.language,
        },
        modelUsed: parsed.model,
        studentId: student.id,
        curriculumId: curriculum.id,
      });
      saved.push(opt);
    }

    this.logger.log(
      `Generated ${saved.length} suggestion option(s) for student ${student.id} / curriculum ${curriculum.id}`,
    );

    return {
      studentId: student.id,
      curriculumId: curriculum.id,
      options: saved,
      sources,
      model: parsed.model,
    };
  }

  /**
   * Resources generator: produce a single, complete, curriculum-grounded
   * artifact of a specific lesson/activity type for one student.
   *
   * Pipeline (mirrors `generate`):
   *   1. Retrieve relevant curriculum chunks (RAG) — the activity must be
   *      grounded in the actual curriculum content, not generic advice.
   *   2. Retrieve the teacher's relevant past feedback (Chunk 8) so the
   *      artifact respects what they accepted/rejected before.
   *   3. Build a strict-JSON prompt for ONE artifact of the requested type.
   *   4. Persist it as a suggestion so it shows up on the Suggestions page too.
   */
  private async generateActivity(
    options: GenerateSuggestionsOptions,
    student: Student,
    curriculum: Curriculum,
  ): Promise<GenerateSuggestionsResult> {
    const activity = getActivityType(options.activityType!);
    if (!activity) {
      throw new BadRequestException(`Unknown activity type: ${options.activityType}`);
    }

    // 1. Retrieve curriculum context. The query includes the activity type so
    //    retrieval pulls chunks most relevant to the specific skill being practiced.
    const query = `${curriculum.title} ${curriculum.subject || ''} ${curriculum.gradeLevel || ''} ${activity.label} ${options.focus || ''}`.trim();
    const sources = await this.rag.retrieve(query, {
      curriculumId: curriculum.id,
      topK: 6,
      minSimilarity: 0.1,
    });

    // 2. Teacher's past feedback (best effort — never blocks generation).
    const teacherId = student.teacher?.id;
    const pastFeedback: Array<{
      action: string;
      reason?: string;
      teacherComment?: string;
      modifiedContent?: string;
      weight: number;
    }> = [];
    if (teacherId) {
      try {
        const { embedding } = await this.gateway.embed(query);
        const relevant = await this.feedbackService.findRelevant(teacherId, embedding, {
          limit: 5,
        });
        for (const fb of relevant) {
          pastFeedback.push({
            action: fb.action,
            reason: fb.reason,
            teacherComment: fb.teacherComment,
            modifiedContent: fb.modifiedContent,
            weight: fb.weight,
          });
        }
      } catch (e) {
        this.logger.warn(
          `Feedback retrieval failed (continuing without it): ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    // 3. Build the prompt.
    const studentContext = this.buildStudentContext(student);
    const contextBlocks = sources.length
      ? sources
          .map(
            (s, i) =>
              `[Source ${i + 1}] (curriculum chunk, similarity ${s.similarity})\n${s.content}`,
          )
          .join('\n\n---\n\n')
      : 'No curriculum chunks were retrieved. Base the artifact on the curriculum title/subject/grade level and the student profile, and label it as a general best-practice activity.';
    const feedbackBlock = this.buildFeedbackBlock(pastFeedback);
    const studentName = `${student.firstName} ${student.lastName}`.trim();

    const prompt = `You are an expert K-12 teacher creating a real, classroom-ready instructional artifact.

STUDENT:
${studentContext}

CURRICULUM:
- Title: ${curriculum.title}
- Subject: ${curriculum.subject || 'Unknown'}
- Grade level: ${curriculum.gradeLevel || 'Unknown'}
${options.focus ? `- Teacher focus: ${options.focus}` : ''}
${options.language ? `\nOUTPUT LANGUAGE: Write ALL human-readable content (title, subtitle, and every block's text) in ${options.language}. Keep the JSON structure and keys in English, but translate the human-readable values into ${options.language}.` : ''}

ARTIFACT TYPE: ${activity.label}
${activity.prompt}

CURRICULUM CONTEXT (retrieved chunks — the artifact MUST be grounded in this):
${contextBlocks}

TEACHER'S PAST FEEDBACK (apply these — higher weight = more relevant):
${feedbackBlock}

REQUIREMENTS:
- The artifact must be specific to THIS student: match their grade, reading level, and any IEP/504 accommodations, ELL status, or learning differences. Do NOT produce a generic template.
- Every skill, problem, or content item must be grounded in the curriculum context above. Cite sources as [1], [2] where relevant.
- If the student has an IEP/504 or is an ELL, include a callout block (variant "accommodation") weaving the accommodations directly into the plan (not as an afterthought).
- The artifact must be complete enough that a teacher could print it and use it tomorrow with no further work.
- If a student field is missing, make a reasonable assumption for the stated grade and note it in the subtitle.

Respond with STRICT JSON only — no markdown, no code fences, no text outside the JSON. Use EXACTLY this shape (a structured document made of ordered "blocks"):
{
  "title": "short descriptive title for the artifact",
  "subtitle": "1-2 sentence overview of what the student will do",
  "meta": {
    "subject": "${curriculum.subject || ''}",
    "grade": "${curriculum.gradeLevel || ''}",
    "activityType": "${activity.label}",
    "studentName": "${studentName}"
  },
  "blocks": [
    { "kind": "heading", "level": 1, "text": "Objectives" },
    { "kind": "list", "ordered": true, "items": ["objective 1", "objective 2"] },
    { "kind": "heading", "level": 1, "text": "Materials" },
    { "kind": "list", "ordered": false, "items": ["item 1", "item 2"] },
    { "kind": "heading", "level": 1, "text": "Procedure" },
    { "kind": "list", "ordered": true, "items": ["step 1", "step 2"] },
    { "kind": "callout", "variant": "accommodation", "text": "accommodation note for this student" },
    { "kind": "problems", "label": "Practice", "problems": [ { "text": "27 + 45 = ?", "points": "2 pts", "answer": "72", "solution": "7+5=12, regroup..." } ] },
    { "kind": "table", "table": { "headers": ["column 1", "column 2"], "rows": [["a", "b"], ["c", "d"]] } },
    { "kind": "answerKey", "problems": [ { "text": "27 + 45 = ?", "answer": "72", "solution": "..." } ] },
    { "kind": "paragraph", "text": "closing note or closure/exit-ticket description" }
  ]
}

BLOCK RULES:
- Use ONLY these block kinds: heading, paragraph, list, table, problems, answerKey, callout.
- "heading" levels: 1 for major sections, 2 for subsections.
- "list": set "ordered" true for numbered steps, false for bullet lists.
- "problems": a numbered set of problems. Put the student-facing problem in "text"; the "answer" and "solution" are used ONLY in the answer key (never printed next to the problem). Include "answer" for every problem that has one.
- "answerKey": repeat the problems WITH their answers/solutions shown. Use it for worksheets, practice sets, and assessments.
- "table": use for vocabulary lists, comparison charts, scoring rubrics, or game card contents.
- "callout": use variant "accommodation" for IEP/504/ELL support, "tip" for teaching tips, "warning" for cautions, or "note" for general notes.
- Order the blocks so the document reads top-to-bottom as a teacher would use it.
- Keep each block's text concise and specific to this student and the curriculum context.`;

    const messages = [
      { role: 'system' as const, content: 'You output strict JSON only. Never include markdown or commentary.' },
      { role: 'user' as const, content: prompt },
    ];
    // Activities are single, complete artifacts — give the model room.
    const chatOpts = { maxTokens: options.maxTokens ?? 8000, temperature: 0.5 };

    // 4. Generate (retry on malformed JSON; small models are less reliable, so
    //    allow a few attempts, and on the final failure fall back to storing
    //    the raw model text as the artifact so the teacher still gets output).
    let parsed: { option: LessonOption; model: string } | undefined;
    let lastError: unknown;
    let lastRaw = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await this.gateway.chat(messages, chatOpts);
      lastRaw = raw.content;
      try {
        parsed = this.parseActivityDocument(raw.content, raw.model);
        break;
      } catch (e) {
        lastError = e;
        this.logger.warn(
          `Activity attempt ${attempt + 1} failed to parse JSON; ${
            attempt < 2 ? 'retrying' : 'falling back to raw text'
          }`,
        );
      }
    }
    if (!parsed) {
      const fallbackContent =
        lastRaw && lastRaw.length > 50
          ? lastRaw
          : 'The model did not return a usable artifact. Please try again.';
      this.logger.error(
        `Activity JSON parse failed after 3 attempts. Raw: ${lastRaw.slice(0, 500)}`,
      );
      // Even on a parse failure, wrap the raw text in a document so it still
      // exports as HTML/DOCX/PDF (as a single paragraph).
      const fallbackDoc = toResourceDocument({
        title: `${activity.label} (unstructured)`,
        subtitle: 'The model did not return structured JSON; the raw output is shown below.',
        blocks: [{ kind: 'paragraph', text: fallbackContent }],
      });
      parsed = {
        option: {
          title: `${activity.label} (unstructured)`,
          type: 'activity',
          summary:
            'The model did not return structured JSON; the raw output is shown below.',
          content: fallbackContent,
          document: fallbackDoc || undefined,
        },
        model: 'unknown',
      };
    }

    // 5. Persist as a suggestion (shows on the Suggestions page + history).
    await this.suggestionService.create({
      type: parsed.option.type,
      content: parsed.option.content,
      title: parsed.option.title,
      details: {
        summary: parsed.option.summary,
        activityType: activity.id,
        sources: sources.map((s) => ({
          chunkId: s.chunkId,
          similarity: s.similarity,
        })),
        focus: options.focus,
        language: options.language,
        document: parsed.option.document as DocumentJson | undefined,
      },
      modelUsed: parsed.model,
      studentId: student.id,
      curriculumId: curriculum.id,
    });

    this.logger.log(
      `Generated ${activity.label} for student ${student.id} / curriculum ${curriculum.id} via ${parsed.model}`,
    );

    return {
      studentId: student.id,
      curriculumId: curriculum.id,
      options: [parsed.option],
      sources,
      model: parsed.model,
    };
  }

  /**
   * Parse the model's output into a structured ResourceDocument. Tolerates
   * code fences, repeated objects, and the legacy { title, summary, content }
   * shape (see toResourceDocument). Returns a LessonOption carrying both the
   * structured document and a flattened plain-text `content` (for the
   * Suggestions page + legacy clients).
   */
  private parseActivityDocument(raw: string, model: string): { option: LessonOption; model: string } {
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();

    let data: any = null;

    // Small models sometimes emit the object more than once (repetition) or
    // wrap it in extra braces. Strategy 1: the outermost balanced object.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        data = JSON.parse(text.slice(start, end + 1));
      } catch {
        data = null;
      }
    }

    // Strategy 2: walk to the first balanced top-level object.
    if (!data) {
      data = this.extractFirstObject(text);
    }

    if (!data) {
      this.logger.error(`Failed to parse activity JSON. Raw: ${raw.slice(0, 500)}`);
      throw new BadRequestException('The model did not return a valid artifact. Please try again.');
    }

    const doc = toResourceDocument(data);
    if (!doc) {
      this.logger.error(`Activity JSON had no usable content. Raw: ${raw.slice(0, 500)}`);
      throw new BadRequestException('The model did not return a valid artifact. Please try again.');
    }

    const content = docToPlainText(doc);
    return {
      option: {
        title: doc.title,
        type: 'activity',
        summary: doc.subtitle || '',
        content,
        document: doc,
      },
      model,
    };
  }

  /**
   * Extract the first top-level {...} object from a string that may contain
   * leading/trailing prose or repeated objects. Walks braces with a string
   * awareness so quotes don't confuse the balance.
   */
  private extractFirstObject(text: string): any | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  private buildRetrievalQuery(
    student: Student,
    curriculum: Curriculum,
    focus?: string,
  ): string {
    const parts = [
      curriculum.title,
      curriculum.subject,
      curriculum.gradeLevel,
    ].filter(Boolean);
    if (student.readingLevel) parts.push(`reading level ${student.readingLevel}`);
    if (student.mathAbility) parts.push(`math ability ${student.mathAbility}`);
    if (focus) parts.push(focus);
    return parts.join(', ');
  }

  /**
   * Chunk 8: render retrieved past feedback into a prompt block. The teacher's
   * explicit guidance (rejected/modified/accepted + reasons) is surfaced so the
   * model can adapt. Empty feedback (first-time teacher) yields a neutral note.
   */
  private buildFeedbackBlock(
    pastFeedback: Array<{
      action: string;
      reason?: string;
      teacherComment?: string;
      modifiedContent?: string;
      weight: number;
    }>,
  ): string {
    if (!pastFeedback || pastFeedback.length === 0) {
      return 'No prior feedback from this teacher yet. Use best-practice personalization.';
    }
    return pastFeedback
      .map((fb, i) => {
        const lines = [
          `Feedback ${i + 1} (action: ${fb.action}, relevance weight ${fb.weight.toFixed(2)}):`,
        ];
        if (fb.reason) lines.push(`  reason: ${fb.reason}`);
        if (fb.teacherComment) lines.push(`  comment: ${fb.teacherComment}`);
        if (fb.modifiedContent) {
          lines.push(`  modified-to: ${fb.modifiedContent.slice(0, 400)}`);
        }
        return lines.join('\n');
      })
      .join('\n\n');
  }

  private buildStudentContext(student: Student): string {
    const lines: string[] = [];
    lines.push(`Name: ${student.firstName} ${student.lastName}`);
    if (student.gradeLevel) lines.push(`Grade: ${student.gradeLevel}`);
    if (student.readingLevel != null) lines.push(`Reading level: ${student.readingLevel}`);
    if (student.mathAbility != null) lines.push(`Math ability: ${student.mathAbility}`);
    if (student.skills?.length) lines.push(`Skills: ${student.skills.join(', ')}`);
    if (student.iepDetails) {
      const iep = student.iepDetails;
      lines.push(
        `IEP/504: ${iep.planType} — accommodations: ${iep.accommodations?.join(', ') || 'none listed'}; goals: ${iep.goals?.join('; ') || 'none listed'}`,
      );
    }
    if (student.ellStatus) {
      const ell = student.ellStatus;
      lines.push(
        `ELL: home language ${ell.homeLanguage}, English proficiency ${ell.englishProficiency}`,
      );
    }
    if (student.learningDifferences?.length) {
      lines.push(
        `Learning differences: ${student.learningDifferences
          .map((d) => `${d.type}${d.diagnosed ? ' (diagnosed)' : ''}`)
          .join(', ')}`,
      );
    }
    if (student.socialEmotionalNotes) lines.push(`Social-emotional: ${student.socialEmotionalNotes}`);
    if (student.teacherNotes) lines.push(`Teacher notes: ${student.teacherNotes}`);
    return lines.join('\n');
  }

  private parseOptionsJson(
    raw: string,
    expectedCount: number,
    model: string,
  ): { options: LessonOption[]; model: string } {
    // Strip markdown code fences if present.
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      text = fence[1].trim();
    }

    let data: any = null;

    // Strategy 1: isolate the outermost JSON object.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        data = JSON.parse(text.slice(start, end + 1));
      } catch {
        data = null;
      }
    }

    // Strategy 2: fall back to the outermost JSON array (small models sometimes
    // return a bare array instead of { options: [...] }).
    if (!data) {
      const aStart = text.indexOf('[');
      const aEnd = text.lastIndexOf(']');
      if (aStart !== -1 && aEnd > aStart) {
        try {
          data = JSON.parse(text.slice(aStart, aEnd + 1));
        } catch {
          data = null;
        }
      }
    }

    if (!data) {
      this.logger.error(`Failed to parse LLM JSON. Raw: ${raw.slice(0, 500)}`);
      throw new BadRequestException(
        'The model did not return valid JSON. Please try again.',
      );
    }

    // Accept { options: [...] } or a bare array.
    let rawOptions: any[] = Array.isArray(data) ? data : data.options;
    if (!Array.isArray(rawOptions)) {
      rawOptions = [];
    }
    if (rawOptions.length === 0) {
      throw new BadRequestException('The model returned no options. Please try again.');
    }

    const validTypes = new Set([
      'lesson_plan',
      'activity',
      'assessment',
      'intervention',
      'resource',
    ]);

    const options: LessonOption[] = rawOptions.slice(0, expectedCount).map((o: any) => ({
      title: String(o?.title || 'Untitled option'),
      type: validTypes.has(o?.type) ? o.type : 'lesson_plan',
      summary: String(o?.summary || ''),
      content: String(o?.content || ''),
    }));

    return { options, model };
  }
}
