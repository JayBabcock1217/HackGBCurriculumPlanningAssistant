const stats = [
  { label: 'Students', value: '24', change: '+2 this month' },
  { label: 'Curricula', value: '5', change: '128 chunks' },
  { label: 'Pending Suggestions', value: '8', change: '3 need review' },
  { label: 'Feedback Entries', value: '47', change: '92% acceptance' },
];

const recentStudents = [
  { name: 'Emma Davis', grade: '3rd', reading: 3.2, math: 2.8, flag: 'IEP' },
  { name: 'Liam Chen', grade: '3rd', reading: 3.5, math: 3.1, flag: null },
  { name: 'Sofia Rodriguez', grade: '3rd', reading: 2.9, math: 2.5, flag: 'ELL' },
  { name: 'Noah Williams', grade: '3rd', reading: 3.8, math: 3.4, flag: null },
  { name: 'Ava Patel', grade: '3rd', reading: 3.1, math: 3.3, flag: '504' },
];

const recentSuggestions = [
  {
    title: 'Fraction Addition - Scaffolded',
    student: 'Sofia Rodriguez',
    type: 'lesson_plan',
    status: 'pending',
    date: 'Oct 15',
  },
  {
    title: 'Word Problems - Visual Approach',
    student: 'Emma Davis',
    type: 'activity',
    status: 'accepted',
    date: 'Oct 14',
  },
  {
    title: 'Multiplication Tables - Drill',
    student: 'Liam Chen',
    type: 'assessment',
    status: 'modified',
    date: 'Oct 13',
  },
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  modified: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back, Sarah. Here&apos;s an overview of your class.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {stat.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Students */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Students
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentStudents.map((student) => (
              <div
                key={student.name}
                className="flex items-center justify-between px-6 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                    {student.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {student.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Reading: {student.reading} · Math: {student.math}
                    </p>
                  </div>
                </div>
                {student.flag && (
                  <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-medium">
                    {student.flag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Suggestions */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Suggestions
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentSuggestions.map((s) => (
              <div
                key={s.title}
                className="flex items-center justify-between px-6 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {s.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.student} · {s.date}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[s.status]}`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skill Progress Chart Placeholder */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Class Skill Mastery
        </h2>
        <div className="space-y-3">
          {[
            { skill: 'Addition', value: 78 },
            { skill: 'Subtraction', value: 72 },
            { skill: 'Multiplication', value: 54 },
            { skill: 'Division', value: 41 },
            { skill: 'Fractions', value: 35 },
          ].map((item) => (
            <div key={item.skill} className="flex items-center gap-4">
              <span className="w-28 text-sm text-slate-600">{item.skill}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full">
                <div
                  className="h-3 rounded-full bg-blue-500"
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-medium text-slate-700">
                {item.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
