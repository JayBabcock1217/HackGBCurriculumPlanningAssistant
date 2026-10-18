#!/usr/bin/env node
/**
 * One-time demo seed: wipe all app data and create a clean, realistic
 * 3rd-grade math class so the app looks finished out of the box.
 *
 * Creates:
 *   - 2 teachers (a demo teacher who owns the class + the admin's teacher row)
 *   - 8 students with varied, realistic profiles (incl. one IEP and one ELL)
 *   - 2 curricula (math + reading) with realistic indexed chunks
 *   - Progress entries for each student (for the dashboards)
 *   - A few suggestions + feedback (so the Suggestions/Feedback pages have content)
 *
 * Idempotent-ish: it wipes students/suggestions/feedback/curricula/chunks/
 * progress first, so re-running is safe. It does NOT touch auth_users except
 * to (re)create the demo teacher + admin accounts.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://hackgb:hackgb_dev_password@postgres:5432/hackgb';

const DEMO_TEACHER = {
  email: 'sarah.cole@school.edu',
  password: 'demo1234',
  firstName: 'Sarah',
  lastName: 'Cole',
};

const ADMIN = {
  email: 'admin@school.edu',
  password: process.env.SEED_ADMIN_PASSWORD || 'HackGB-Admin-2026',
  firstName: 'Admin',
  lastName: 'User',
};

// 8 realistic 3rd-grade students.
const STUDENTS = [
  {
    firstName: 'Ava', lastName: 'Patel', gradeLevel: '3rd',
    readingLevel: 3.4, mathAbility: 3.1,
    skills: ['phonics', 'addition', 'multiplication'],
    iepDetails: null, ellStatus: null,
    learningDifferences: [],
    socialEmotionalNotes: 'Responds well to visual aids and quiet workspaces.',
    teacherNotes: 'Quick to grasp new concepts; ready for extension work.',
  },
  {
    firstName: 'Noah', lastName: 'Williams', gradeLevel: '3rd',
    readingLevel: 2.6, mathAbility: 2.4,
    skills: ['counting', 'addition'],
    iepDetails: {
      planType: 'IEP',
      accommodations: ['extended time', 'small-group instruction', 'visual supports'],
      goals: ['Independently add two-digit numbers with regrouping by end of quarter'],
      lastReviewed: '2026-01-15',
      notes: 'Works best with concrete manipulatives (base-ten blocks).',
    },
    ellStatus: null,
    learningDifferences: [{ type: 'Dyslexia', diagnosed: true, notes: 'Struggles with multi-step written instructions.' }],
    socialEmotionalNotes: 'Needs frequent breaks and positive reinforcement.',
    teacherNotes: 'Make a point to pair him with a patient peer partner.',
  },
  {
    firstName: 'Sofia', lastName: 'Rodriguez', gradeLevel: '3rd',
    readingLevel: 2.9, mathAbility: 2.5,
    skills: ['phonics', 'addition', 'subtraction'],
    iepDetails: null,
    ellStatus: {
      homeLanguage: 'Spanish',
      englishProficiency: 'beginner',
      ellStartDate: '2026-01-05',
      notes: 'Strong math background from home; language is the main barrier.',
    },
    learningDifferences: [],
    socialEmotionalNotes: 'Shy in large groups; thrives in small-group settings.',
    teacherNotes: 'Provide key vocabulary in both Spanish and English.',
  },
  {
    firstName: 'Lily', lastName: 'Kim', gradeLevel: '3rd',
    readingLevel: 3.2, mathAbility: 3.0,
    skills: ['phonics', 'addition', 'subtraction', 'place value'],
    iepDetails: null, ellStatus: null,
    learningDifferences: [],
    socialEmotionalNotes: 'Very organized and self-directed.',
    teacherNotes: 'Could benefit from more open-ended, exploratory math tasks.',
  },
  {
    firstName: 'Maya', lastName: 'Singh', gradeLevel: '3rd',
    readingLevel: 3.0, mathAbility: 2.8,
    skills: ['addition', 'subtraction', 'place value'],
    iepDetails: {
      planType: '504',
      accommodations: ['preferential seating', 'frequent check-ins'],
      goals: ['Sustain focus on independent work for 15+ minutes'],
      lastReviewed: '2026-02-01',
      notes: '504 plan for attention; not a learning disability.',
    },
    ellStatus: null,
    learningDifferences: [{ type: 'ADHD', diagnosed: true, notes: 'Responds well to movement breaks and chunked tasks.' }],
    socialEmotionalNotes: 'Enthusiastic and eager; benefits from clear, short instructions.',
    teacherNotes: 'Break longer tasks into smaller steps with visible progress markers.',
  },
  {
    firstName: 'Ben', lastName: 'Carter', gradeLevel: '3rd',
    readingLevel: 3.5, mathAbility: 3.3,
    skills: ['addition', 'subtraction', 'multiplication', 'division'],
    iepDetails: null, ellStatus: null,
    learningDifferences: [],
    socialEmotionalNotes: 'Natural leader; sometimes rushes ahead of peers.',
    teacherNotes: 'Challenge with word problems that require multi-step reasoning.',
  },
  {
    firstName: 'Emma', lastName: 'Johnson', gradeLevel: '3rd',
    readingLevel: 2.8, mathAbility: 2.6,
    skills: ['addition', 'subtraction'],
    iepDetails: null, ellStatus: null,
    learningDifferences: [{ type: 'Auditory processing', diagnosed: false, notes: 'Prefers written over verbal instructions.' }],
    socialEmotionalNotes: 'Anxious about making mistakes; needs low-stakes practice.',
    teacherNotes: 'Provide written instructions alongside verbal ones.',
  },
  {
    firstName: 'Lucas', lastName: 'Martinez', gradeLevel: '3rd',
    readingLevel: 2.5, mathAbility: 2.3,
    skills: ['counting', 'addition'],
    iepDetails: null, ellStatus: null,
    learningDifferences: [],
    socialEmotionalNotes: 'New to the class this semester; still building confidence.',
    teacherNotes: 'Needs extra scaffolding and a lot of positive encouragement.',
  },
];

// 2 realistic curricula with indexed chunks.
const CURRICULA = [
  {
    title: '3rd Grade Math - Unit 1: Addition & Subtraction',
    subject: 'Math', gradeLevel: '3rd', fileType: 'pdf',
    fileName: 'grade3-math-unit1-addition-subtraction.pdf',
    description: 'Two-digit addition and subtraction with and without regrouping, place-value strategies, and word problems.',
    chunks: [
      'Lesson 1.1: Introduction to two-digit addition. Students add numbers up to 99 using place-value strategies. Emphasis on aligning tens and ones columns before adding.',
      'Lesson 1.2: Adding with regrouping. When the ones column sums to 10 or more, students regroup 10 ones as 1 ten. Uses base-ten blocks to model the trade before recording it in standard form.',
      'Lesson 1.3: Subtracting without regrouping. Students subtract two-digit numbers where the ones digit of the subtrahend is smaller than the minuend, reinforcing place value.',
      'Lesson 1.4: Subtracting with regrouping. Students borrow 1 ten (10 ones) from the tens column. Concrete-then-abstract approach with manipulatives, drawings, then equations.',
      'Lesson 1.5: Word problems combining addition and subtraction. Students read a short scenario, decide whether to add or subtract, write the number sentence, and solve. Includes check-your-work strategies.',
      'Assessment: Unit 1 quiz covering two-digit addition and subtraction with and without regrouping, plus 2 multi-step word problems.',
    ],
  },
  {
    title: '3rd Grade Reading - Unit 1: Main Idea & Supporting Details',
    subject: 'Reading', gradeLevel: '3rd', fileType: 'pdf',
    fileName: 'grade3-reading-unit1-main-idea.pdf',
    description: 'Identifying the main idea of a text and locating supporting details; inferring from context clues.',
    chunks: [
      'Lesson 1.1: What is the main idea? The main idea is the most important point an author wants to communicate. Students practice finding the topic sentence in a paragraph.',
      'Lesson 1.2: Supporting details. Details are facts, examples, and descriptions that support the main idea. Students underline details and explain how each one backs up the main point.',
      'Lesson 1.3: Combining main idea and details. Students write the main idea in one sentence and list two supporting details, then explain the connection in their own words.',
      'Lesson 1.4: Inferring from context clues. When a new word appears, students use surrounding words and their own knowledge to guess its meaning, then verify with a dictionary.',
      'Assessment: Students read a short informational passage and identify the main idea, list supporting details, and infer the meaning of one unfamiliar word.',
    ],
  },
];

// Suggestions + feedback to seed (created AFTER students/curricula so we can
// reference real ids). Content is short but realistic.
const SUGGESTION_SEEDS = [
  {
    // For Noah (IEP, dyslexia) — accepted
    studentIdx: 1,
    curriculumIdx: 0,
    type: 'intervention',
    title: 'Base-Ten Blocks: Two-Digit Addition with Regrouping',
    summary: 'Hands-on intervention using base-ten blocks to model regrouping before moving to paper-and-pencil.',
    content:
      'OBJECTIVES: Noah will independently add two-digit numbers with regrouping using concrete manipulatives, then transition to standard form.\n\nMATERIALS: Base-ten blocks (10 ones = 1 ten), number lines, dry-erase boards.\n\nPROCEDURE:\n1. Model adding 27 + 45 with blocks. Show 7 ones + 5 ones = 12 ones; trade 10 ones for 1 ten.\n2. Noah repeats with 38 + 26, narrating each trade.\n3. Move to a drawing phase: represent the trade with tens/ones dots.\n4. Finally, write the equation in standard form.\n\nACCOMMODATIONS: Small-group (1:1), extended time, visual trade cards at his desk.\n\nASSESSMENT: Noah correctly solves 3 problems with regrouping, explaining the trade each time.',
    status: 'accepted',
    feedback: {
      action: 'accepted',
      reason: 'Concrete approach works best for Noah',
      teacherComment: 'The base-ten trade cards were exactly what he needed. He got all 3 assessment problems right.',
    },
  },
  {
    // For Sofia (ELL) — modified
    studentIdx: 2,
    curriculumIdx: 1,
    type: 'activity',
    title: 'Main Idea & Details: Bilingual Picture-Story Task',
    summary: 'Sofia identifies the main idea and details in a short story, with key vocabulary provided in Spanish and English.',
    content:
      'OBJECTIVES: Sofia will identify the main idea of a short passage and list two supporting details, using a bilingual vocabulary list.\n\nMATERIALS: One-page picture story, Spanish/English word bank, graphic organizer (main idea box + 2 detail boxes).\n\nPROCEDURE:\n1. Pre-teach 5 key words with the word bank (e.g., "problem" / "problema").\n2. Read the story together; Sofia underlines the topic sentence.\n3. Sofia fills the organizer: main idea + 2 details.\n4. Pair-share: Sofia explains one detail to a classmate.\n\nACCOMMODATIONS: Bilingual vocabulary, small-group setting, visual organizer.\n\nASSESSMENT: Organizer is complete with a defensible main idea and 2 relevant details.',
    status: 'modified',
    feedback: {
      action: 'modified',
      reason: 'Too much text; shortened the story',
      teacherComment: 'Swapped the story for a 4-sentence version and added more pictures. She completed the organizer fully this time.',
      modifiedContent:
        'OBJECTIVES: Sofia will identify the main idea of a 4-sentence picture story and list two supporting details, using a bilingual vocabulary list.\n\nMATERIALS: 4-sentence picture story, Spanish/English word bank, graphic organizer.\n\nPROCEDURE:\n1. Pre-teach 5 key words with the word bank.\n2. Read the 4-sentence story together; Sofia underlines the topic sentence.\n3. Sofia fills the organizer: main idea + 2 details.\n4. Pair-share one detail with a classmate.\n\nACCOMMODATIONS: Bilingual vocabulary, small-group, visual organizer, shorter text.\n\nASSESSMENT: Organizer complete with a defensible main idea and 2 relevant details.',
    },
  },
  {
    // For Maya (504/ADHD) — rejected
    studentIdx: 4,
    curriculumIdx: 0,
    type: 'lesson_plan',
    title: 'Silent Independent Practice: 20-Problem Addition Worksheet',
    summary: 'A 20-problem worksheet for Maya to complete independently for 30 minutes.',
    content:
      'OBJECTIVES: Maya will practice two-digit addition fluency.\n\nMATERIALS: 20-problem worksheet, pencil, timer.\n\nPROCEDURE:\n1. Distribute the worksheet.\n2. Maya works silently for 30 minutes.\n3. Teacher collects and checks for accuracy.\n\nASSESSMENT: 18/20 correct.',
    status: 'rejected',
    feedback: {
      action: 'rejected',
      reason: 'Does not fit her 504 plan; 30 min silent work is too long',
      teacherComment: 'Maya needs chunked tasks with movement breaks per her 504. A 30-minute silent block is counterproductive for her. I broke it into 4 x 5-minute rounds with a stretch break in between instead.',
    },
  },
  {
    // For Ava — pending (no feedback yet)
    studentIdx: 0,
    curriculumIdx: 0,
    type: 'lesson_plan',
    title: 'Extension: Multi-Step Word Problems with Regrouping',
    summary: 'Ava tackles 2-step word problems that require both addition with regrouping and a follow-up subtraction.',
    content:
      'OBJECTIVES: Ava will solve 2-step addition/subtraction word problems and explain her reasoning.\n\nMATERIALS: Word-problem cards, whiteboard, peer-review checklist.\n\nPROCEDURE:\n1. Ava reads a 2-step problem and identifies which operation to do first.\n2. She solves each step, labeling the answer to step 1.\n3. She checks her work using the reverse operation.\n4. Peer review: a classmate uses the checklist to verify the steps.\n\nDIFFERENTIATION: Provide a 3-step problem as a stretch challenge.\n\nASSESSMENT: Correct answers + a written explanation of the two steps.',
    status: 'pending',
    feedback: null,
  },
  {
    // For Ben — pending
    studentIdx: 5,
    curriculumIdx: 0,
    type: 'activity',
    title: 'Math Center: Regrouping Relay (Small Group)',
    summary: 'Ben leads a small-group relay where the team solves regrouping problems at stations.',
    content:
      'OBJECTIVES: Ben will apply two-digit addition with regrouping in a collaborative, game-based setting and model problem-solving for peers.\n\nMATERIALS: 4 station cards, timer, team score sheet.\n\nPROCEDURE:\n1. Split into 2 teams of 3; Ben captains one team.\n2. Each station has 1 regrouping problem; teams rotate every 2 minutes.\n3. Ben is responsible for explaining the trade to his team at each station.\n4. Debrief: which strategy was fastest?\n\nDIFFERENTIATION: Add a 3-digit problem at the last station as a challenge.\n\nASSESSMENT: Team accuracy + Ben\'s verbal explanation quality.',
    status: 'pending',
    feedback: null,
  },
];

// Progress entries per student (for the dashboards). Spread across ~6 weeks.
// Each entry: { skillArea, skillName, score, maxScore, notes, daysAgo }
function buildProgress(studentIdx, level) {
  // level: 'high' | 'mid' | 'low' — scales scores
  const scale = level === 'high' ? 0.9 : level === 'mid' ? 0.7 : 0.5;
  const base = [
    { skillArea: 'math', skillName: 'Two-digit addition', daysAgo: 40, score: Math.round(6 * scale), maxScore: 10, notes: 'First baseline check.' },
    { skillArea: 'math', skillName: 'Two-digit addition', daysAgo: 28, score: Math.round(7 * scale), maxScore: 10, notes: 'Improved on regrouping problems.' },
    { skillArea: 'math', skillName: 'Subtraction with regrouping', daysAgo: 21, score: Math.round(6 * scale), maxScore: 10, notes: null },
    { skillArea: 'math', skillName: 'Subtraction with regrouping', daysAgo: 14, score: Math.round(8 * scale), maxScore: 10, notes: 'Solid understanding of the trade.' },
    { skillArea: 'math', skillName: 'Word problems', daysAgo: 7, score: Math.round(7 * scale), maxScore: 10, notes: null },
    { skillArea: 'reading', skillName: 'Main idea identification', daysAgo: 10, score: Math.round(7 * scale), maxScore: 10, notes: 'Found the topic sentence easily.' },
  ];
  return base;
}

const LEVEL_BY_STUDENT = { 0: 'high', 1: 'low', 2: 'mid', 3: 'high', 4: 'mid', 5: 'high', 6: 'mid', 7: 'low' };

const client = new Client({ connectionString: databaseUrl });

function daysAgoIso(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

async function main() {
  await client.connect();
  console.log('Connected. Wiping app data…');

  // Wipe in FK-safe order.
  await client.query(`DELETE FROM feedback`);
  await client.query(`DELETE FROM suggestions`);
  await client.query(`DELETE FROM progress_entries`);
  await client.query(`DELETE FROM curriculum_chunks`);
  await client.query(`DELETE FROM curricula`);
  await client.query(`DELETE FROM students`);
  // Remove all teachers except keep none — we'll recreate the demo ones.
  await client.query(`DELETE FROM teachers`);
  // Remove auth accounts for the demo teacher + admin (we'll recreate them).
  await client.query(`DELETE FROM auth_users WHERE email IN ($1, $2)`, [DEMO_TEACHER.email, ADMIN.email]);

  console.log('Wiped. Creating teachers…');
  const teacherRes = await client.query(
    `INSERT INTO teachers (email, "firstName", "lastName", role, "schoolName", "gradeLevel", subject)
     VALUES ($1, $2, $3, 'teacher', $4, $5, $6) RETURNING id`,
    [DEMO_TEACHER.email, DEMO_TEACHER.firstName, DEMO_TEACHER.lastName, 'Riverside Elementary', '3rd', 'Math & Reading'],
  );
  const demoTeacherId = teacherRes.rows[0].id;
  console.log(`  Demo teacher: ${DEMO_TEACHER.email} (${demoTeacherId})`);

  const adminTeacherRes = await client.query(
    `INSERT INTO teachers (email, "firstName", "lastName", role, "schoolName")
     VALUES ($1, $2, $3, 'admin', $4) RETURNING id`,
    [ADMIN.email, ADMIN.firstName, ADMIN.lastName, 'Riverside Elementary'],
  );
  const adminTeacherId = adminTeacherRes.rows[0].id;

  // Auth accounts (bcrypt).
  const teacherHash = await bcrypt.hash(DEMO_TEACHER.password, 10);
  await client.query(
    `INSERT INTO auth_users (email, "passwordHash", role, "teacherId", "refreshTokens")
     VALUES ($1, $2, 'teacher', $3, '[]')`,
    [DEMO_TEACHER.email, teacherHash, demoTeacherId],
  );
  console.log(`  Auth: ${DEMO_TEACHER.email} (teacher, pw ${DEMO_TEACHER.password})`);

  const adminHash = await bcrypt.hash(ADMIN.password, 10);
  await client.query(
    `INSERT INTO auth_users (email, "passwordHash", role, "teacherId", "refreshTokens")
     VALUES ($1, $2, 'admin', $3, '[]')`,
    [ADMIN.email, adminHash, adminTeacherId],
  );
  console.log(`  Auth: ${ADMIN.email} (admin, pw ${ADMIN.password})`);

  console.log('Creating students…');
  const studentIds = [];
  for (const s of STUDENTS) {
    const res = await client.query(
      `INSERT INTO students
         ("firstName","lastName","gradeLevel","readingLevel","mathAbility",
          skills,"iepDetails","ellStatus","learningDifferences",
          "socialEmotionalNotes","teacherNotes","teacherId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        s.firstName, s.lastName, s.gradeLevel, s.readingLevel, s.mathAbility,
        JSON.stringify(s.skills), JSON.stringify(s.iepDetails), JSON.stringify(s.ellStatus),
        JSON.stringify(s.learningDifferences), s.socialEmotionalNotes, s.teacherNotes, demoTeacherId,
      ],
    );
    studentIds.push(res.rows[0].id);
  }
  console.log(`  ${studentIds.length} students created.`);

  console.log('Creating curricula + chunks…');
  const curriculumIds = [];
  for (const c of CURRICULA) {
    const curRes = await client.query(
      `INSERT INTO curricula
         (title, subject, "gradeLevel", description, "fileType", "fileName", "chunkCount", metadata, "teacherId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [c.title, c.subject, c.gradeLevel, c.description, c.fileType, c.fileName, c.chunks.length, JSON.stringify({}), demoTeacherId],
    );
    const curId = curRes.rows[0].id;
    curriculumIds.push(curId);
    // Insert chunks with NULL embeddings (no vector search until re-embedded).
    for (let i = 0; i < c.chunks.length; i++) {
      await client.query(
        `INSERT INTO curriculum_chunks (content, "chunkIndex", "tokenCount", embedding, metadata, "curriculumId")
         VALUES ($1,$2,$3,NULL,$4,$5)`,
        [c.chunks[i], i, Math.ceil(c.chunks[i].split(/\s+/).length), JSON.stringify({ section: `Lesson ${i + 1}` }), curId],
      );
    }
    console.log(`  ${c.title} (${c.chunks.length} chunks)`);
  }

  console.log('Creating progress entries…');
  let progressCount = 0;
  for (let i = 0; i < studentIds.length; i++) {
    const level = LEVEL_BY_STUDENT[i];
    const entries = buildProgress(i, level);
    for (const e of entries) {
      await client.query(
        `INSERT INTO progress_entries
           ("skillArea","skillName",score,"maxScore",notes,details,"studentId","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [e.skillArea, e.skillName, e.score, e.maxScore, e.notes, JSON.stringify({}), studentIds[i], daysAgoIso(e.daysAgo)],
      );
      progressCount++;
    }
  }
  console.log(`  ${progressCount} progress entries created.`);

  console.log('Creating suggestions + feedback…');
  let fbCount = 0;
  for (const s of SUGGESTION_SEEDS) {
    const genId = `gen_seed_${Math.random().toString(36).slice(2, 8)}`;
    const sugRes = await client.query(
      `INSERT INTO suggestions
         (type, content, title, details, status, "modelUsed", "studentId", "curriculumId", "ownerId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        s.type, s.content, s.title,
        JSON.stringify({
          summary: s.summary,
          generationId: genId,
          focus: s.summary.slice(0, 80),
          sources: [{ chunkId: curriculumIds[s.curriculumIdx], similarity: 0.78 }],
        }),
        s.status, 'llama3.2:1b',
        studentIds[s.studentIdx], curriculumIds[s.curriculumIdx], demoTeacherId,
      ],
    );
    const sugId = sugRes.rows[0].id;
    if (s.feedback) {
      await client.query(
        `INSERT INTO feedback
           (action, reason, "teacherComment", "modifiedContent", embedding, "suggestionId", "teacherId")
         VALUES ($1,$2,$3,$4,NULL,$5,$6)`,
        [s.feedback.action, s.feedback.reason, s.feedback.teacherComment, s.feedback.modifiedContent, sugId, demoTeacherId],
      );
      fbCount++;
    }
  }
  console.log(`  ${SUGGESTION_SEEDS.length} suggestions, ${fbCount} feedback entries.`);

  console.log('Done.');
  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  try { client.end(); } catch {}
  process.exit(1);
});
