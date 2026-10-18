const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';

/**
 * Thin fetch wrapper over the HackGB backend. Every method throws an Error
 * with a human-readable message on non-2xx responses so the UI can surface
 * a single, friendly error banner.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      // multipart requests set their own Content-Type
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.message || data.error || message;
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- Types ----------

export interface Teacher {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolName?: string;
  gradeLevel?: string;
  subject?: string;
  language?: string;
  role?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel?: string;
  readingLevel?: number;
  mathAbility?: number;
  skills?: string[];
  iepDetails?: {
    planType: 'IEP' | '504';
    accommodations: string[];
    goals: string[];
    lastReviewed?: string;
    notes?: string;
  } | null;
  ellStatus?: {
    homeLanguage: string;
    englishProficiency: 'beginner' | 'intermediate' | 'advanced' | 'fluent';
    ellStartDate?: string;
    notes?: string;
  } | null;
  learningDifferences?: Array<{ type: string; diagnosed: boolean; notes?: string }>;
  socialEmotionalNotes?: string;
  teacherNotes?: string;
  teacher?: { id: string };
  progressEntries?: ProgressEntry[];
}

export interface ProgressEntry {
  id: string;
  skillArea: string;
  skillName: string;
  score: number;
  maxScore?: number;
  notes?: string;
  createdAt: string;
}

export interface Curriculum {
  id: string;
  title: string;
  subject?: string;
  gradeLevel?: string;
  description?: string;
  fileType: 'pdf' | 'word' | 'google_docs';
  fileName: string;
  chunkCount: number;
  createdAt: string;
  teacher?: { id: string };
}

export interface Suggestion {
  id: string;
  type: 'lesson_plan' | 'activity' | 'assessment' | 'intervention' | 'resource';
  content: string;
  title?: string;
  details?: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'modified' | 'rejected' | 'archived';
  modelUsed?: string;
  createdAt: string;
  student?: { id: string; firstName: string; lastName: string };
  curriculum?: { id: string; title: string };
  feedback?: {
    action: string;
    reason?: string;
    teacherComment?: string;
    modifiedContent?: string;
  } | null;
}

export interface GenerateResult {
  studentId: string;
  curriculumId: string;
  options: Array<{
    title: string;
    type: string;
    summary: string;
    content: string;
  }>;
  sources: Array<{
    chunkId: string;
    content: string;
    chunkIndex: number;
    similarity: number;
    curriculumId: string;
  }>;
  model: string;
}

export interface RagResult {
  answer: string;
  model: string;
  sources: Array<{
    chunkId: string;
    content: string;
    chunkIndex: number;
    similarity: number;
    curriculumId: string;
    curriculumTitle: string;
  }>;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  capabilities: string[];
  model?: string;
}

// ---------- Health ----------

export async function getBackendStatus() {
  return request<Record<string, unknown>>('/api/health');
}

// ---------- Teachers ----------

export const createTeacher = (dto: Partial<Teacher>) =>
  request<Teacher>('/api/teachers', { method: 'POST', body: JSON.stringify(dto) });

export const getTeachers = () => request<Teacher[]>('/api/teachers');

// ---------- Students ----------

export const getStudents = (teacherId?: string) =>
  request<Student[]>(`/api/students${teacherId ? `?teacherId=${teacherId}` : ''}`);

export const getStudent = (id: string) => request<Student>(`/api/students/${id}`);

export const createStudent = (dto: Partial<Student> & { teacherId: string }) =>
  request<Student>('/api/students', { method: 'POST', body: JSON.stringify(dto) });

export const updateStudent = (id: string, dto: Partial<Student>) =>
  request<Student>(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(dto) });

export const deleteStudent = (id: string) =>
  request<void>(`/api/students/${id}`, { method: 'DELETE' });

export const addProgressEntry = (
  studentId: string,
  dto: {
    skillArea: string;
    skillName: string;
    score: number;
    maxScore?: number;
    notes?: string;
  },
) =>
  request<ProgressEntry>(`/api/students/${studentId}/progress`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });

// ---------- Curricula ----------

export const getCurricula = (teacherId?: string) =>
  request<Curriculum[]>(`/api/curricula${teacherId ? `?teacherId=${teacherId}` : ''}`);

export const uploadCurriculum = (
  file: File,
  fields: { title: string; teacherId: string; subject?: string; gradeLevel?: string; description?: string },
) => {
  const form = new FormData();
  form.append('file', file);
  form.append('title', fields.title);
  form.append('teacherId', fields.teacherId);
  if (fields.subject) form.append('subject', fields.subject);
  if (fields.gradeLevel) form.append('gradeLevel', fields.gradeLevel);
  if (fields.description) form.append('description', fields.description);
  return request<{ curriculumId: string; totalChunks: number }>(
    '/api/curricula/upload',
    { method: 'POST', body: form },
  );
};

export const deleteCurriculum = (id: string) =>
  request<void>(`/api/curricula/${id}/file`, { method: 'DELETE' });

// ---------- RAG ----------

export const ragRetrieve = (
  query: string,
  opts: { curriculumId?: string; topK?: number; minSimilarity?: number } = {},
) =>
  request<RagResult['sources']>('/api/rag/retrieve', {
    method: 'POST',
    body: JSON.stringify({ query, ...opts }),
  });

export const ragAsk = (
  query: string,
  opts: { curriculumId?: string; topK?: number; minSimilarity?: number; systemContext?: string; maxTokens?: number } = {},
) =>
  request<RagResult>('/api/rag/ask', {
    method: 'POST',
    body: JSON.stringify({ query, ...opts }),
  });

export const ragReembed = (curriculumId: string) =>
  request<{ curriculumId: string; chunksReembedded: number; model: string; dimensions: number }>(
    '/api/rag/reembed',
    { method: 'POST', body: JSON.stringify({ curriculumId }) },
  );

// ---------- Suggestions ----------

export const getSuggestions = (
  params: { studentId?: string; curriculumId?: string; status?: string } = {},
) => {
  const qs = new URLSearchParams();
  if (params.studentId) qs.set('studentId', params.studentId);
  if (params.curriculumId) qs.set('curriculumId', params.curriculumId);
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  return request<Suggestion[]>(`/api/suggestions${q ? `?${q}` : ''}`);
};

export const generateSuggestions = (
  body: { studentId: string; curriculumId: string; optionCount?: number; focus?: string },
) =>
  request<GenerateResult>('/api/suggestions/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateSuggestionStatus = (
  id: string,
  status: Suggestion['status'],
) =>
  request<Suggestion>(`/api/suggestions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });

export const deleteSuggestion = (id: string) =>
  request<void>(`/api/suggestions/${id}`, { method: 'DELETE' });

export interface Feedback {
  id: string;
  action: 'accepted' | 'modified' | 'rejected';
  reason?: string;
  teacherComment?: string;
  modifiedContent?: string;
  createdAt: string;
  suggestion?: { id: string; title?: string; student?: { id: string; firstName: string; lastName: string } };
}

// ---------- Feedback ----------

export const getFeedback = (teacherId?: string) =>
  request<Feedback[]>(`/api/feedback${teacherId ? `?teacherId=${teacherId}` : ''}`);

export const createFeedback = (dto: {
  action: 'accepted' | 'modified' | 'rejected';
  reason?: string;
  teacherComment?: string;
  modifiedContent?: string;
  suggestionId: string;
  teacherId: string;
}) => request<Feedback>('/api/feedback', { method: 'POST', body: JSON.stringify(dto) });

export const updateFeedback = (id: string, dto: Partial<Omit<Feedback, 'id' | 'createdAt'>>) =>
  request<Feedback>(`/api/feedback/${id}`, { method: 'PUT', body: JSON.stringify(dto) });

export const deleteFeedback = (id: string) =>
  request<void>(`/api/feedback/${id}`, { method: 'DELETE' });

// ---------- LLM ----------

export const getProviders = () => request<ProviderInfo[]>('/api/llm/providers');
