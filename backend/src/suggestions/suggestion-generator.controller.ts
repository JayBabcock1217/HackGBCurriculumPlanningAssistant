import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  SuggestionGeneratorService,
  GenerateSuggestionsOptions,
  GenerateSuggestionsResult,
} from './suggestion-generator.service';
import { SuggestionService } from '../database/suggestion/suggestion.service';
import { ACTIVITY_TYPES } from './activity-types';
import { toResourceDocument, ResourceDocument } from './document-schema';
import { docToHtml } from './document-renderer';
import { DocxRenderer } from './docx-renderer';
import { PdfRenderer } from './pdf-renderer';
import { CurrentUser } from '../database/auth/current-user.decorator';
import type { SafeUser } from '../database/auth/auth.service';

/**
 * SuggestionGeneratorController (Chunk 7)
 *
 *   POST /api/suggestions/generate — generate personalized lesson options
 *   POST /api/suggestions/generate/start — start a background resource job
 *   GET  /api/suggestions/generate/status/:id — poll a background job
 *   GET  /api/suggestions/generate/activity-types — list activity types
 *   GET  /api/suggestions/documents/:id?format=html|docx|pdf|json — download a
 *        generated resource as a real document
 *
 * (List/fetch/update/delete of individual suggestions live on the existing
 * SuggestionController from Chunk 2, also on the /suggestions path.)
 */
@Controller('suggestions')
export class SuggestionGeneratorController {
  constructor(
    private readonly generator: SuggestionGeneratorService,
    private readonly suggestionService: SuggestionService,
    private readonly pdfRenderer: PdfRenderer,
  ) {}

  @Post('generate')
  generate(@Body() body: GenerateSuggestionsOptions) {
    if (!body?.studentId || !body?.curriculumId) {
      throw new Error('studentId and curriculumId are required');
    }
    return this.generator.generate({
      studentId: body.studentId,
      curriculumId: body.curriculumId,
      optionCount: body.optionCount,
      focus: body.focus,
      maxTokens: body.maxTokens,
      language: body.language,
      activityType: body.activityType,
    });
  }

  /**
   * Lesson/activity types available to the Resources generator.
   * (Lives under /generate/ so it is not shadowed by the SuggestionController's
   * GET /suggestions/:id param route.)
   */
  @Get('generate/activity-types')
  activityTypes() {
    return ACTIVITY_TYPES;
  }

  /**
   * Chunk 12: start a background resource-generation job. Returns the job id
   * immediately so the client can navigate away; the LLM work continues
   * server-side and is tracked via the status endpoint.
   */
  @Post('generate/start')
  async start(
    @Body() body: GenerateSuggestionsOptions,
    @CurrentUser() user: SafeUser,
  ): Promise<{ jobId: string }> {
    if (!body?.studentId || !body?.curriculumId) {
      throw new Error('studentId and curriculumId are required');
    }
    const jobId = await this.generator.startJob(
      {
        studentId: body.studentId,
        curriculumId: body.curriculumId,
        optionCount: body.optionCount,
        focus: body.focus,
        maxTokens: body.maxTokens,
        language: body.language,
        kind: body.kind,
        activityType: body.activityType,
      },
      user.id,
    );
    return { jobId };
  }

  /** Chunk 12: poll a background generation job (owner-only). */
  @Get('generate/status/:id')
  status(
    @Param('id') id: string,
    @CurrentUser() user: SafeUser,
  ): Promise<GenerateSuggestionsResult> {
    return this.generator.jobStatus(id, user.id);
  }

  /**
   * Download a generated resource as a real document.
   *
   *   format=json  -> the typed document schema (for inspection / re-render)
   *   format=html  -> printable, self-contained HTML (open, print, or save)
   *   format=docx  -> editable Microsoft Word file
   *   format=pdf   -> print-ready PDF (rendered from the HTML via headless Chromium)
   *
   * The document is read from the suggestion row (details.document when present,
   * falling back to flattening details.content). Owner-only.
   */
  @Get('documents/:id')
  async download(
    @Param('id') id: string,
    @Query('format') format: string,
    @CurrentUser() user: SafeUser,
    @Res() res: Response,
  ): Promise<void> {
    const suggestion = await this.suggestionService.findOne(id);
    if (suggestion.ownerId && suggestion.ownerId !== user.id) {
      res.status(403).json({ message: 'Not your document' });
      return;
    }

    const doc = this.resolveDocument(suggestion);
    if (!doc) {
      res
        .status(422)
        .json({ message: 'This suggestion has no document content to export.' });
      return;
    }

    const safeName = (doc.title || 'resource')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'resource';

    const fmt = (format || 'html').toLowerCase();
    try {
      if (fmt === 'json') {
        res
          .set('Content-Type', 'application/json')
          .set('Content-Disposition', `attachment; filename="${safeName}.json"`)
          .send(JSON.stringify(doc, null, 2));
        return;
      }

      if (fmt === 'html') {
        const html = docToHtml(doc, { printable: true });
        res
          .set('Content-Type', 'text/html; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="${safeName}.html"`)
          .send(html);
        return;
      }

      if (fmt === 'docx') {
        const buf = await DocxRenderer.toBuffer(doc);
        res
          .set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
          .set('Content-Disposition', `attachment; filename="${safeName}.docx"`)
          .send(buf);
        return;
      }

      if (fmt === 'pdf') {
        const html = docToHtml(doc, { printable: true });
        const buf = await this.pdfRenderer.render(html);
        res
          .set('Content-Type', 'application/pdf')
          .set('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
          .send(buf);
        return;
      }

      res
        .status(400)
        .json({ message: `Unsupported format: ${format}. Use html, docx, pdf, or json.` });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // PDF rendering can fail if Chromium can't launch in this environment.
      res.status(500).json({
        message: `Could not generate ${fmt} file: ${message}`,
        hint:
          fmt === 'pdf'
            ? 'PDF rendering may be unavailable in this deployment. Try HTML or DOCX instead.'
            : undefined,
      });
    }
  }

  /**
   * Recover a ResourceDocument from a suggestion row. Prefers the structured
   * details.document; otherwise falls back to flattening the stored plain-text
   * content (wrapped as a single paragraph) so older/legacy resources still
   * export.
   */
  private resolveDocument(suggestion: {
    details?: Record<string, unknown>;
    content?: string;
    title?: string;
  }): ResourceDocument | null {
    const d = (suggestion.details as Record<string, unknown>) || {};
    if (d.document && typeof d.document === 'object') {
      const fromDoc = toResourceDocument(d.document as any);
      if (fromDoc) return fromDoc;
    }
    if (typeof suggestion.content === 'string' && suggestion.content.trim()) {
      return toResourceDocument({
        title: suggestion.title,
        content: suggestion.content,
      });
    }
    return null;
  }
}
