import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'HackGB Curriculum Assistant',
  description: 'Web-based app to assist teachers in developing personalized curricula',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  const links = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/students', label: 'Students', icon: '👨‍🎓' },
    { href: '/curricula', label: 'Curricula', icon: '📚' },
    { href: '/suggestions', label: 'Suggestions', icon: '💡' },
    { href: '/feedback', label: 'Feedback', icon: '📝' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-lg font-bold">HackGB</h1>
        <p className="text-xs text-slate-400">Curriculum Assistant</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
            SJ
          </div>
          <div>
            <p className="text-sm font-medium">Sarah Johnson</p>
            <p className="text-xs text-slate-400">3rd Grade Math</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
