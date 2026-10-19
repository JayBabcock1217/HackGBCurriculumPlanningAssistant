/**
 * Typed document schema for the Resources generator.
 *
 * Instead of asking the LLM for a wall of plain text, the activity prompt now
 * requests a STRUCTURED document: a title, an optional materials list, and an
 * ordered list of blocks (headings, paragraphs, numbered/bulleted lists,
 * tables, problem sets, answer keys, callouts). The document is:
 *   - persisted as JSON (details.document) so it can be re-rendered later,
 *   - rendered to printable HTML (DocumentRenderer) for the UI + PDF,
 *   - rendered to a .docx (Word) file for download/editing,
 *   - flattened to plain text (content) for the Suggestions page + fallbacks.
 *
 * Keeping the schema open-ended (an ordered block list) means every activity
 * type — worksheet, lesson plan, game, assessment, project, intervention —
 * produces a properly laid-out document with no type-specific code.
 */

export interface DocTable {
  /** Column headers (first row). */
  headers: string[];
  /** Rows of cells; each row should match headers.length. */
  rows: string[][];
}

export interface DocProblem {
  /** The problem text (e.g. "27 + 45 = ?"). */
  text: string;
  /** Optional point value / label shown after the problem. */
  points?: string;
  /**
   * For problem sets: the answer shown in the answer key (NOT printed next to
   * the problem). Empty/undefined problems have no answer-key line.
   */
  answer?: string;
  /** Optional worked solution / rationale shown in the answer key. */
  solution?: string;
}

export type DocBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; table: DocTable }
  | {
      kind: 'problems';
      /** Optional section label, e.g. "Practice" or "Assessment". */
      label?: string;
      problems: DocProblem[];
    }
  | { kind: 'answerKey'; problems: DocProblem[] }
  | {
      kind: 'callout';
      /** e.g. "tip" | "accommodation" | "warning" | "note". */
      variant?: string;
      text: string;
    };

export interface DocMeta {
  subject?: string;
  grade?: string;
  /** The activity type label, e.g. "Worksheet". */
  activityType?: string;
  /** The student name the document is tailored for. */
  studentName?: string;
}

/** A complete, renderable instructional document. */
export interface ResourceDocument {
  title: string;
  subtitle?: string;
  meta?: DocMeta;
  blocks: DocBlock[];
}

/**
 * Coerce unknown model output into a ResourceDocument. Tolerates:
 *   - a bare ResourceDocument object
 *   - the legacy single-activity shape { title, type, summary, content } where
 *     content is a string (wrapped in one paragraph) or an object (best-effort
 *     mapped to blocks)
 *   - content returned as an object of { section: string | string[] | object }
 * Returns null when nothing usable can be recovered.
 */
export function toResourceDocument(raw: any): ResourceDocument | null {
  if (!raw || typeof raw !== 'object') return null;

  // Already a structured document.
  if (Array.isArray(raw.blocks)) {
    return {
      title: String(raw.title || 'Generated activity'),
      subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
      meta: raw.meta || undefined,
      blocks: (raw.blocks as DocBlock[]).filter((b) => b && typeof b === 'object' && b.kind),
    };
  }

  // Legacy shape: { title, summary, content }.
  const content = raw.content ?? raw.text;
  const title = String(raw.title || 'Generated activity');
  if (content == null) return null;

  const blocks: DocBlock[] = [];
  if (typeof content === 'string') {
    if (content.trim()) blocks.push({ kind: 'paragraph', text: content.trim() });
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === 'string') blocks.push({ kind: 'paragraph', text: item });
      else if (item && typeof item === 'object') blocks.push(...objectToBlocks(item));
    }
  } else if (typeof content === 'object') {
    blocks.push(...objectToBlocks(content));
  }
  if (blocks.length === 0) return null;

  return {
    title,
    subtitle: raw.summary ? String(raw.summary) : undefined,
    blocks,
  };
}

/**
 * Best-effort mapping of an arbitrary object (e.g. { "Materials": "...",
 * "Procedure": ["1. ...", ...] }) into heading + content blocks. Used when a
 * model returns content as a sectioned object instead of the block schema.
 */
function objectToBlocks(obj: Record<string, unknown>): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const [key, value] of Object.entries(obj)) {
    blocks.push({ kind: 'heading', level: 2, text: key });
    if (typeof value === 'string') {
      blocks.push({ kind: 'paragraph', text: value });
    } else if (Array.isArray(value)) {
      if (value.every((v) => typeof v === 'string')) {
        blocks.push({ kind: 'list', ordered: false, items: value as string[] });
      } else {
        for (const v of value) {
          if (typeof v === 'string') blocks.push({ kind: 'paragraph', text: v });
          else if (v && typeof v === 'object') blocks.push(...objectToBlocks(v));
        }
      }
    } else if (value && typeof value === 'object') {
      for (const [vk, vv] of Object.entries(value as Record<string, unknown>)) {
        blocks.push({ kind: 'paragraph', text: `${vk}: ${Array.isArray(vv) ? vv.join(', ') : String(vv)}` });
      }
    }
  }
  return blocks;
}
