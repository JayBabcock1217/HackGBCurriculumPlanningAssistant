const students = [
  {
    id: '1',
    firstName: 'Emma',
    lastName: 'Davis',
    grade: '3rd',
    readingLevel: 3.2,
    mathAbility: 2.8,
    skills: ['addition', 'subtraction', 'phonics'],
    iep: 'IEP - extra time on tests, prefer visual materials',
    ell: null,
    learningDifferences: ['dyslexia'],
    socialEmotional: 'Shy but improving. Works well in small groups.',
    progress: [
      { date: 'Oct 15', skill: 'Addition', score: 82, max: 100 },
      { date: 'Oct 10', skill: 'Phonics', score: 75, max: 100 },
      { date: 'Oct 5', skill: 'Subtraction', score: 78, max: 100 },
    ],
  },
  {
    id: '2',
    firstName: 'Liam',
    lastName: 'Chen',
    grade: '3rd',
    readingLevel: 3.5,
    mathAbility: 3.1,
    skills: ['addition', 'subtraction', 'multiplication'],
    iep: null,
    ell: null,
    learningDifferences: [],
    socialEmotional: 'Confident and engaged. Good peer tutor.',
    progress: [
      { date: 'Oct 15', skill: 'Multiplication', score: 88, max: 100 },
      { date: 'Oct 10', skill: 'Addition', score: 92, max: 100 },
      { date: 'Oct 5', skill: 'Subtraction', score: 85, max: 100 },
    ],
  },
  {
    id: '3',
    firstName: 'Sofia',
    lastName: 'Rodriguez',
    grade: '3rd',
    readingLevel: 2.9,
    mathAbility: 2.5,
    skills: ['phonics', 'basic addition'],
    iep: null,
    ell: 'Spanish - intermediate English proficiency',
    learningDifferences: [],
    socialEmotional: 'Eager to participate. Needs extra time to process in English.',
    progress: [
      { date: 'Oct 15', skill: 'Phonics', score: 68, max: 100 },
      { date: 'Oct 10', skill: 'Addition', score: 71, max: 100 },
    ],
  },
  {
    id: '4',
    firstName: 'Noah',
    lastName: 'Williams',
    grade: '3rd',
    readingLevel: 3.8,
    mathAbility: 3.4,
    skills: ['addition', 'subtraction', 'multiplication', 'fractions'],
    iep: null,
    ell: null,
    learningDifferences: [],
    socialEmotional: 'Strong leader. Ready for extension activities.',
    progress: [
      { date: 'Oct 15', skill: 'Fractions', score: 80, max: 100 },
      { date: 'Oct 10', skill: 'Multiplication', score: 90, max: 100 },
    ],
  },
  {
    id: '5',
    firstName: 'Ava',
    lastName: 'Patel',
    grade: '3rd',
    readingLevel: 3.1,
    mathAbility: 3.3,
    skills: ['addition', 'subtraction', 'multiplication'],
    iep: '504 - prefer standing desk, breaks as needed',
    ell: null,
    learningDifferences: ['ADHD'],
    socialEmotional: 'Bright and creative. Benefits from movement breaks.',
    progress: [
      { date: 'Oct 15', skill: 'Multiplication', score: 85, max: 100 },
      { date: 'Oct 10', skill: 'Addition', score: 91, max: 100 },
    ],
  },
];

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 mt-1">
            24 students in 3rd Grade Math
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Student
        </button>
      </div>

      <div className="space-y-4">
        {students.map((student) => (
          <div
            key={student.id}
            className="bg-white rounded-xl shadow-sm"
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                  {student.firstName[0]}
                  {student.lastName[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {student.firstName} {student.lastName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {student.grade}
                    </span>
                    {student.iep && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                        {student.iep.split(' - ')[0]}
                      </span>
                    )}
                    {student.ell && (
                      <span className="text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-medium">
                        ELL
                      </span>
                    )}
                    {student.learningDifferences.map((ld) => (
                      <span
                        key={ld}
                        className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium"
                      >
                        {ld}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Reading</p>
                  <p className="text-xl font-bold text-slate-900">
                    {student.readingLevel}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Math</p>
                  <p className="text-xl font-bold text-slate-900">
                    {student.mathAbility}
                  </p>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  View Profile →
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="px-6 pb-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Recent Progress
              </p>
              <div className="flex gap-4">
                {student.progress.map((p) => (
                  <div
                    key={p.date}
                    className="flex-1 bg-slate-50 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{p.skill}</span>
                      <span className="text-xs font-medium text-slate-700">
                        {p.score}/{p.max}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${(p.score / p.max) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{p.date}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="px-6 pb-6">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">
                  Social/Emotional:
                </span>{' '}
                {student.socialEmotional}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
