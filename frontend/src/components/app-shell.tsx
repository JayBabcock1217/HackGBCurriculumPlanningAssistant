'use client';

import { Sidebar } from '@/components/sidebar';
import { AuthGuard } from '@/components/auth-guard';

/**
 * AppShell (Chunk 11)
 *
 * Sidebar + content area for authenticated pages. The login page renders
 * outside of this (it has no sidebar).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
