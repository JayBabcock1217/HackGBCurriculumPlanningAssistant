const feedback = [
  {
    id: '1',
    action: 'rejected',
    suggestionTitle: 'Division Concept - Equal Groups',
    student: 'Sofia Rodriguez',
    reason: 'Too much text, needs visual approach',
    comment:
      'Sofia is still building English proficiency. She needs picture-based instructions and physical manipulatives. Avoid text-heavy materials for her until her reading improves.',
    date: 'Oct 12, 2025',
    edited: false,
  },
  {
    id: '2',
    action: 'modified',
    suggestionTitle: 'Multiplication Tables - Gamified Drill',
    student: 'Liam Chen',
    reason: 'Adjusted difficulty level',
    comment:
      'Changed focus from 2-digit multiplication to 5s and 10s patterns. Liam is ready for extension but needs to solidify these patterns first. The card game format worked well though.',
    date: 'Oct 13, 2025',
    edited: true,
  },
  {
    id: '3',
    action: 'accepted',
    suggestionTitle: 'Word Problems - Visual Story Approach',
    student: 'Emma Davis',
    reason: 'Perfect fit for Emma',
    comment:
      'The visual story frames were exactly what Emma needed. The large dyslexia-friendly fonts helped a lot. Consider adding a matching activity for kinesthetic learning next time.',
    date: 'Oct 14, 2025',
    edited: false,
  },
  {
    id: '4',
    action: 'accepted',
    suggestionTitle: 'Fraction Addition - Scaffolded Lesson',
    student: 'Sofia Rodriguez',
    reason: 'Good scaffolding approach',
    comment:
      'The visual fraction bars and bilingual vocabulary list were great. The hands-on paper activity worked well. Keep this style for Sofia going forward.',
    date: 'Oct 15, 2025',
    edited: false,
  },
  {
    id: '5',
    action: 'modified',
    suggestionTitle: 'Reading Comprehension - Inference Practice',
    student: 'Emma Davis',
    reason: 'Shortened activity length',
    comment:
      'Reduced from 30 min to 15 min. Emma loses focus after about 12-15 minutes of reading tasks. The inference questions were good but too many for one session.',
    date: 'Oct 10, 2025',
    edited: true,
  },
  {
    id: '6',
    action: 'rejected',
    suggestionTitle: 'Multiplication - Timed Drill',
    student: 'Ava Patel',
    reason: 'Not suitable for ADHD',
    comment:
      'Timed drills are stressful for Ava. She performs much better with self-paced activities. Avoid time pressure for her. Try incorporating movement breaks and choice-based activities instead.',
    date: 'Oct 8, 2025',
    edited: false,
  },
];

const actionStyles: Record<string, string> = {
  accepted: 'bg-green-100 text-green-800',
  modified: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

const actionIcons: Record<string, string> = {
  accepted: '✓',
  modified: '✏️',
  rejected: '✕',
};

export default function FeedbackPage() {
  const counts = {
    accepted: feedback.filter((f) => f.action === 'accepted').length,
    modified: feedback.filter((f) => f.action === 'modified').length,
    rejected: feedback.filter((f) => f.action === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Teacher Feedback
        </h1>
        <p className="text-slate-500 mt-1">
          Your feedback guides the AI&apos;s future suggestions. Edit or delete
          any entry at any time.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {counts.accepted}
          </p>
          <p className="text-xs text-slate-500">Accepted</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {counts.modified}
          </p>
          <p className="text-xs text-slate-500">Modified</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {counts.rejected}
          </p>
          <p className="text-xs text-slate-500">Rejected</p>
        </div>
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {feedback.map((f) => (
          <div
            key={f.id}
            className="bg-white rounded-xl shadow-sm p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${actionStyles[f.action]}`}
                >
                  {actionIcons[f.action]}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {f.suggestionTitle}
                    </h3>
                    {f.edited && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        edited
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {f.student} · {f.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-slate-400 hover:text-blue-600">
                  Edit
                </button>
                <button className="text-xs text-slate-400 hover:text-red-600">
                  Delete
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-600 mt-3 ml-11">
              <span className="font-medium text-slate-700">
                Reason:
              </span>{' '}
              {f.reason}
            </p>
            <p className="text-sm text-slate-500 mt-1 ml-11 leading-relaxed">
              {f.comment}
            </p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          How feedback guides suggestions
        </h3>
        <p className="text-sm text-blue-700 leading-relaxed">
          Before generating new suggestions, the system searches your past
          feedback for relevant entries and includes them in the AI&apos;s
          context. For example, after you rejected the division lesson for
          Sofia, the AI now knows to prioritize visual and hands-on approaches
          with minimal text for ELL students. Recent feedback carries more
          weight than older entries.
        </p>
      </div>
    </div>
  );
}
