const curricula = [
  {
    id: '1',
    title: '3rd Grade Math - Unit 1: Addition & Subtraction',
    subject: 'Math',
    gradeLevel: '3rd',
    fileType: 'PDF',
    fileName: 'math-unit1.pdf',
    chunkCount: 24,
    uploaded: 'Oct 1, 2025',
    status: 'processed',
  },
  {
    id: '2',
    title: '3rd Grade Math - Unit 2: Multiplication',
    subject: 'Math',
    gradeLevel: '3rd',
    fileType: 'PDF',
    fileName: 'math-unit2.pdf',
    chunkCount: 18,
    uploaded: 'Oct 5, 2025',
    status: 'processed',
  },
  {
    id: '3',
    title: '3rd Grade Math - Unit 3: Division',
    subject: 'Math',
    gradeLevel: '3rd',
    fileType: 'PDF',
    fileName: 'math-unit3.pdf',
    chunkCount: 15,
    uploaded: 'Oct 10, 2025',
    status: 'processing',
  },
  {
    id: '4',
    title: '3rd Grade Reading - Fiction Unit',
    subject: 'Reading',
    gradeLevel: '3rd',
    fileType: 'Word',
    fileName: 'reading-fiction.docx',
    chunkCount: 32,
    uploaded: 'Oct 2, 2025',
    status: 'processed',
  },
  {
    id: '5',
    title: '3rd Grade Science - Life Cycles',
    subject: 'Science',
    gradeLevel: '3rd',
    fileType: 'Google Docs',
    fileName: 'science-lifecycles',
    chunkCount: 0,
    uploaded: 'Oct 16, 2025',
    status: 'uploading',
  },
];

const statusStyles: Record<string, string> = {
  processed: 'bg-green-100 text-green-800',
  processing: 'bg-yellow-100 text-yellow-800',
  uploading: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
};

export default function CurriculaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Curricula</h1>
          <p className="text-slate-500 mt-1">
            5 curricula · 89 chunks indexed
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Upload Curriculum
        </button>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
        <p className="text-4xl mb-2">📄</p>
        <p className="text-slate-600 font-medium">
          Drag &amp; drop files here, or click to browse
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Supports PDF, Word (.docx), Google Docs · Sync from Google Classroom
          or Canvas
        </p>
      </div>

      {/* Curricula list */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-slate-100">
        {curricula.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg">
                {c.fileType === 'PDF' && '📕'}
                {c.fileType === 'Word' && '📘'}
                {c.fileType === 'Google Docs' && '📗'}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {c.title}
                </p>
                <p className="text-xs text-slate-500">
                  {c.fileType} · {c.chunkCount} chunks · {c.uploaded}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[c.status]}`}
              >
                {c.status}
              </span>
              <button className="text-sm text-slate-400 hover:text-slate-600">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
