/**
 * Activity / lesson types for the Resources generator.
 *
 * Each entry describes a legitimate, curriculum-grounded kind of instructional
 * activity the teacher can request. The `prompt` is appended to the generation
 * prompt so the LLM produces a complete, classroom-ready artifact for that
 * type (objectives, materials, procedure, differentiation, assessment).
 */
export interface ActivityType {
  id: string;
  label: string;
  /** Short description shown in the UI dropdown. */
  hint: string;
  /** Instruction appended to the LLM prompt for this type. */
  prompt: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'guided_lesson',
    label: 'Guided Lesson',
    hint: 'A full 40-minute lesson with direct instruction, guided practice, and independent practice.',
    prompt:
      'Generate a complete 40-minute guided lesson. Include: a clear learning objective (standards-aligned where possible), materials list, ' +
      'a 10-minute direct-instruction segment with a worked example, a 15-minute guided-practice segment with teacher modeling and think-alouds, ' +
      'a 10-minute independent-practice segment, and a 5-minute closure/exit ticket. Number every step.',
  },
  {
    id: 'worksheet',
    label: 'Worksheet',
    hint: 'A printable worksheet of targeted practice problems with an answer key.',
    prompt:
      'Generate a printable one-page worksheet. Include a title, a 1-2 sentence directions line, 10-15 targeted practice problems ordered easy-to-hard ' +
      'that directly exercise the curriculum skill, and a separate ANSWER KEY section at the bottom with a brief rationale for each answer. ' +
      'Format so it prints cleanly (no colors or tables that break on paper).',
  },
  {
    id: 'reading',
    label: 'Leveled Reading',
    hint: 'A short leveled reading passage followed by comprehension questions.',
    prompt:
      'Write a short, authentic-feeling reading passage (150-250 words) at the student\'s level, tied to the curriculum topic, followed by 5 comprehension ' +
      'questions: 2 literal (answer stated in the text), 2 inferential, and 1 application question. Include an answer key with model answers. ' +
      'Add a 5-word vocabulary list with simple definitions for the questions.',
  },
  {
    id: 'practice',
    label: 'Practice Problems',
    hint: 'A set of graded practice problems progressing from easy to hard.',
    prompt:
      'Generate a set of 12 graded practice problems that progress from easy (fluency/warm-up) to hard (application/multi-step), each directly grounded ' +
      'in the curriculum content. Label the three difficulty tiers. Include an answer key with worked solutions for the hard tier only.',
  },
  {
    id: 'assessment',
    label: 'Short Assessment',
    hint: 'A 10-question formative assessment with a scoring rubric.',
    prompt:
      'Generate a 10-question formative assessment (mix of multiple-choice, short-answer, and one constructed-response) that measures the curriculum ' +
      'skill. Include a point value per question (total = 20 pts), a scoring rubric for the constructed-response item, and a complete answer key.',
  },
  {
    id: 'project',
    label: 'Project / Activity',
    hint: 'A hands-on, multi-step project or hands-on activity the student completes.',
    prompt:
      'Generate a hands-on project or activity (25-45 minutes). Include: an engaging scenario or driving question, a materials list (common classroom ' +
      'materials only), a numbered step-by-step procedure the student can follow independently, differentiation options for extension and support, ' +
      'and a success criteria checklist the student can self-assess against.',
  },
  {
    id: 'game',
    label: 'Game',
    hint: 'A classroom game that practices the skill (cards, relay, board game, etc.).',
    prompt:
      'Design a classroom game (15-30 minutes) that practices the curriculum skill. Specify: the game\'s name and goal, materials needed, exact rules ' +
      'in numbered steps, how to set it up, 10-12 game pieces/cards with their content (so it is playable without invention), and a debrief question ' +
      'that connects the game back to the skill.',
  },
  {
    id: 'intervention',
    label: 'Intervention',
    hint: 'A short, targeted small-group or 1:1 intervention plan for a struggling skill.',
    prompt:
      'Generate a 15-20 minute targeted intervention plan for a student struggling with this skill. Include: the specific skill gap being addressed, ' +
      'materials, a concrete-then-abstract procedure (manipulatives/drawings before symbols) with 3 progressively harder examples, ' +
      'built-in check-for-understanding checkpoints after each step, and 2 exit criteria the student must meet to progress.',
  },
];

export function getActivityType(id: string): ActivityType | undefined {
  return ACTIVITY_TYPES.find((t) => t.id === id);
}
