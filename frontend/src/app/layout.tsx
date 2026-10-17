import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'HackGB Curriculum Assistant',
  description:
    'Web-based app to assist teachers in developing personalized curricula',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('hackgb-theme');
                  var theme = stored ||
                    (window.matchMedia('(prefers-color-scheme: dark)').matches
                      ? 'dark'
                      : 'light');
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="ml-64 flex-1 overflow-auto p-6 lg:p-8">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
