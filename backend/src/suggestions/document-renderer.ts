import { DocBlock, DocProblem, ResourceDocument } from './document-schema';

/** Escape text for safe inclusion in HTML. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Flatten a problem set into plain text. When `showAnswers` is false (the
 * student-facing side), problems are printed without their answers; the
 * answer key block carries those separately.
 */
function problemsToText(problems: DocProblem[], showAnswers: boolean): string {
  return problems
    .map((p, i) => {
      const line = `${i + 1}. ${p.text}${p.points ? `   [${p.points}]` : ''}`;
      if (showAnswers && (p.answer || p.solution)) {
        const ans = p.answer ? ` — ${p.answer}` : '';
        const sol = p.solution ? `\n   Solution: ${p.solution}` : '';
        return line + ans + sol;
      }
      return line;
    })
    .join('\n');
}

/** Flatten a document to plain text (Suggestions page, fallbacks, copy). */
export function docToPlainText(doc: ResourceDocument): string {
  const lines: string[] = [];
  if (doc.title) lines.push(doc.title.toUpperCase());
  if (doc.subtitle) lines.push(doc.subtitle);
  const meta = doc.meta;
  if (meta) {
    const bits: string[] = [];
    if (meta.subject) bits.push(`Subject: ${meta.subject}`);
    if (meta.grade) bits.push(`Grade: ${meta.grade}`);
    if (meta.activityType) bits.push(meta.activityType);
    if (meta.studentName) bits.push(`For: ${meta.studentName}`);
    if (bits.length) lines.push(bits.join('  ·  '));
  }
  lines.push('');

  for (const block of doc.blocks) {
    const text = blockToText(block);
    if (text) lines.push(text, '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function blockToText(b: DocBlock): string {
  switch (b.kind) {
    case 'heading':
      return b.text.toUpperCase();
    case 'paragraph':
      return b.text;
    case 'list':
      return b.items
        .map((it, i) => `${b.ordered ? `${i + 1}.` : '•'} ${it}`)
        .join('\n');
    case 'table': {
      const { headers, rows } = b.table;
      const all = [headers, ...rows];
      const widths = headers.map((_, c) =>
        Math.max(...all.map((r) => String(r[c] ?? '').length)),
      );
      const fmt = (r: string[]) =>
        r.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  |  ');
      const sep = widths.map((w) => '-'.repeat(w)).join('-+-');
      return [fmt(headers), sep, ...rows.map(fmt)].join('\n');
    }
    case 'problems':
      return (b.label ? b.label.toUpperCase() + '\n' : '') + problemsToText(b.problems, false);
    case 'answerKey':
      return 'ANSWER KEY\n' + problemsToText(b.problems, true);
    case 'callout':
      return `[${(b.variant || 'note').toUpperCase()}] ${b.text}`;
    default:
      return '';
  }
}

/**
 * Render a document to a self-contained, print-ready HTML string. The CSS is
 * embedded so the same markup is usable for on-screen preview, "Download
 * HTML", and PDF generation (the backend prints this to PDF).
 */
export function docToHtml(doc: ResourceDocument, opts: { printable?: boolean } = {}): string {
  const body = docBlocksToHtml(doc.blocks);
  const meta = doc.meta;
  const metaLine = meta
    ? [meta.subject && `Subject: ${esc(meta.subject)}`, meta.grade && `Grade: ${esc(meta.grade)}`, meta.activityType && esc(meta.activityType), meta.studentName && `For: ${esc(meta.studentName)}`]
        .filter(Boolean)
        .join(' &middot; ')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(doc.title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a; background: #fff;
    max-width: 8.5in; margin: 0 auto; padding: 0.75in 0.9in;
    line-height: 1.5; font-size: 12pt;
  }
  header.doc-head { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 18px; }
  h1.doc-title { font-size: 20pt; margin: 0 0 4px; letter-spacing: 0.2px; }
  p.doc-subtitle { margin: 0; font-size: 11.5pt; color: #444; font-style: italic; }
  p.doc-meta { margin: 8px 0 0; font-size: 9.5pt; color: #666; font-family: Arial, Helvetica, sans-serif; }
  h2 { font-size: 13pt; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 11.5pt; margin: 14px 0 6px; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin: 3px 0; }
  table.doc-table { border-collapse: collapse; width: 100%; margin: 0 0 14px; font-size: 11pt; font-family: Arial, Helvetica, sans-serif; }
  table.doc-table th, table.doc-table td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.doc-table th { background: #f0f0f0; font-weight: bold; }
  ol.doc-problems, ol.doc-problems-ak { padding-left: 26px; margin: 0 0 12px; }
  ol.doc-problems li { margin: 10px 0; }
  ol.doc-problems-ak li { margin: 6px 0; }
  .problem-pts { font-size: 9pt; color: #777; }
  .ak-answer { font-weight: bold; }
  .ak-solution { display: block; color: #444; font-size: 10pt; margin-top: 2px; }
  .doc-callout { border-left: 4px solid #888; background: #f6f6f6; padding: 8px 12px; margin: 0 0 14px; font-size: 11pt; }
  .doc-callout .callout-label { font-weight: bold; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; color: #555; display: block; margin-bottom: 2px; font-family: Arial, Helvetica, sans-serif; }
  .doc-callout.accommodation, .doc-callout.tip { border-color: #2a7de1; background: #eef4fd; }
  .doc-callout.warning { border-color: #d97706; background: #fdf3e7; }
  .doc-answer-key { margin-top: 22px; border-top: 2px dashed #999; padding-top: 12px; }
  .doc-footnote { margin-top: 26px; font-size: 8.5pt; color: #888; border-top: 1px solid #ddd; padding-top: 6px; font-family: Arial, Helvetica, sans-serif; }
  ${opts.printable ? '@media print { body { padding: 0.4in 0.5in; } .no-print { display: none; } }' : ''}
</style>
</head>
<body>
<header class="doc-head">
  <h1 class="doc-title">${esc(doc.title)}</h1>
  ${doc.subtitle ? `<p class="doc-subtitle">${esc(doc.subtitle)}</p>` : ''}
  ${metaLine ? `<p class="doc-meta">${metaLine}</p>` : ''}
</header>
<main>
${body}
</main>
<p class="doc-footnote">Generated by HackGB Curriculum Planning Assistant</p>
</body>
</html>`;
}

function docBlocksToHtml(blocks: DocBlock[]): string {
  return blocks
    .map((b) => blockToHtml(b))
    .filter(Boolean)
    .join('\n');
}

function blockToHtml(b: DocBlock): string {
  switch (b.kind) {
    case 'heading':
      return `<h${Math.min(3, b.level + 1)}>${esc(b.text)}</h${Math.min(3, b.level + 1)}>`;
    case 'paragraph':
      return `<p>${esc(b.text)}</p>`;
    case 'list':
      return b.ordered
        ? `<ol>${b.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ol>`
        : `<ul>${b.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>`;
    case 'table': {
      const { headers, rows } = b.table;
      const head = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
      const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
      return `<table class="doc-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    }
    case 'problems':
      return (
        (b.label ? `<h3>${esc(b.label)}</h3>` : '') +
        `<ol class="doc-problems">${b.problems
          .map((p) => `<li>${esc(p.text)}${p.points ? ` <span class="problem-pts">[${esc(p.points)}]</span>` : ''}</li>`)
          .join('')}</ol>`
      );
    case 'answerKey':
      return (
        `<div class="doc-answer-key"><h2>Answer Key</h2>` +
        `<ol class="doc-problems-ak">${b.problems
          .map(
            (p) =>
              `<li>${esc(p.text)}${
                p.answer ? ` — <span class="ak-answer">${esc(p.answer)}</span>` : ''
              }${p.solution ? `<span class="ak-solution">Solution: ${esc(p.solution)}</span>` : ''}</li>`,
          )
          .join('')}</ol></div>`
      );
    case 'callout':
      return `<div class="doc-callout ${esc(b.variant || 'note')}"><span class="callout-label">${esc(
        b.variant || 'note',
      )}</span>${esc(b.text)}</div>`;
    default:
      return '';
  }
}
