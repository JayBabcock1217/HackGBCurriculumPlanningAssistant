import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StudentService } from '../database/student/student.service';
import { CurriculumService } from '../database/curriculum/curriculum.service';
import { SuggestionService } from '../database/suggestion/suggestion.service';
import { RagService } from '../rag/rag.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { FeedbackService } from '../database/feedback/feedback.service';
import { Student } from '../database/student/student.entity';
import { Curriculum } from '../database/curriculum/curriculum.entity';

export interface GenerateSuggestionsOptions {
  studentId: string;
  curriculumId: string;
  /** Number of distinct options to generate (default 3, max 5). */
  optionCount?: number;
  /** Optional focus/ask from the teacher, e.g. "focus on regrouping". */
  focus?: string;
  maxTokens?: number;
}

export interface LessonOption {
  title: string;
  type: 'lesson_plan' | 'activity' | 'assessment' | 'intervention' | 'resource';
  summary: string;
  content: string;
}

export interface SuggestionSource {
  chunkId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  curriculumId: string;
}

export interface GenerateSuggestionsResult {
  studentId: string;
  curriculumId: string;
  options: LessonOption[];
  sources: SuggestionSource[];
  model: string;
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

  async generate(options: GenerateSuggestionsOptions): Promise<GenerateSuggestionsResult> {
    const optionCount = Math.min(Math.max(options.optionCount ?? 3, 1), 5);

    // 1. Load inputs
    const student = await this.studentService.findOne(options.studentId);
    const curriculum = await this.curriculumService.findOne(options.curriculumId);

    if (!student || !curriculum) {
      throw new BadRequestException('Student or curriculum not found');
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
