const suggestions = [
  {
    id: '1',
    title: 'Fraction Addition - Scaffolded Lesson',
    student: 'Sofia Rodriguez',
    studentLevel: 'Reading 2.9 · Math 2.5 · ELL (Spanish)',
    type: 'lesson_plan',
    status: 'pending',
    model: 'Ollama / Llama 3',
    date: 'Oct 15, 2025',
    summary:
      'A 30-minute scaffolded lesson introducing fraction addition using visual fraction bars. Includes a bilingual vocabulary list (Spanish/English) and a hands-on activity with paper fraction strips. Aligned to curriculum Unit 2 objectives.',
    options: 3,
  },
  {
    id: '2',
    title: 'Word Problems - Visual Story Approach',
    student: 'Emma Davis',
    studentLevel: 'Reading 3.2 · Math 2.8 · IEP (Dyslexia)',
    type: 'activity',
    status: 'accepted',
    model: 'Ollama / Llama 3',
    date: 'Oct 14, 2025',
    summary:
      'A 20-minute activity using visual story frames to help students break down word problems. Includes a step-by-step graphic organizer with large, dyslexia-friendly fonts. Three practice problems with visual supports.',
    options: 2,
    feedback:
      'Great approach! The visual story frames work well for Emma. Consider adding a matching activity for kinesthetic learning.',
  },
  {
    id: '3',
    title: 'Multiplication Tables - Gamified Drill',
    student: 'Liam Chen',
    studentLevel: 'Reading 3.5 · Math 3.1',
    type: 'assessment',
    status: 'modified',
    model: 'Ollama / Llama 3',
    date: 'Oct 13, 2025',
    summary:
      'A 15-minute gamified multiplication drill using a card game format. Originally designed for 2-digit x 1-digit, but modified to focus on 5s and 10s patterns since Liam is stronger in that area.',
    options: 4,
    feedback:
      'Modified to focus on 5s and 10s patterns instead of 2-digit multiplication. Liam is ready for extension work but needs to solidify these patterns first.',
  },
  {
    id: '4',
    title: 'Division Concept - Equal Groups',
    student: 'Sofia Rodriguez',
    studentLevel: 'Reading 2.9 · Math 2.5 · ELL (Spanish)',
    type: 'intervention',
    status: 'rejected',
    model: 'Ollama / Llama 3',
    date: 'Oct 12, 2025',
    summary:
      'A 45-minute intervention lesson on division using equal groups with manipulatives. Uses a lot of text-based instructions with minimal visual supports.',
    options: 2,
    feedback:
      'Rejected because too much text for Sofia. She needs more visual and hands-on approaches with less written instruction. Try using picture-based instructions and physical manipulatives only.',
  },
  {
    id: '5',
    title: 'Fractions - Extension Challenge',
    student: 'Noah Williams',
    studentLevel: 'Reading 3.8 · Math 3.4',
    type: 'resource',
    status: 'pending',
    model: 'Ollama / Llama 3',
    date: 'Oct 15, 2025',
    summary:
      'An extension activity for advanced learners: comparing and ordering fractions with unlike denominators. Includes a real-world cooking application and a challenge problem set.',
    options: 2,
  },
];

const typeIcons: Record<string, string> = {
  lesson_plan: '📋',
  activity: '🎯',
  assessment: '📝',
  intervention: '🔧',
  resource: '📦',
};

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  modified: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  archived: 'bg-slate-100 text-slate-600',
};

export default function SuggestionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Suggestions
          </h1>
          <p className="text-slate-500 mt-1">
            5 suggestions · 2 pending review
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          ✨ Generate New Suggestions
        </button>
      </div>

      <div className="space-y-4">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{typeIcons[s.type]}</span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {s.student} · {s.studentLevel}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {s.model} · {s.date} · {s.options} options generated
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${statusStyles[s.status]}`}
              >
                {s.status}
              </span>
            </div>

            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              {s.summary}
            </p>

            {s.feedback && (
              <div className="mt-4 bg-slate-50 rounded-lg p-4 border-l-4 border-slate-300">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Teacher Feedback
                </p>
                <p className="text-sm text-slate-700">{s.feedback}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              {s.status === 'pending' && (
                <>
                  <button className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                    ✓ Accept
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    ✏️ Modify
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    ✕ Reject
                  </button>
                </>
              )}
              {s.status !== 'pending' && (
                <button className="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                  View Details
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
