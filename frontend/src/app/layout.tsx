import type { Metadata } from 'next';
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
      <body>{children}</body>
    </html>
  );
}
